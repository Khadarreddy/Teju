/**
 * RTOS Kernel & Scheduler Module
 * Implements Rate Monotonic Scheduling (RMS) and Earliest Deadline First (EDF)
 */

class RTOSKernel {
  constructor() {
    this.tasks = [];
    this.algorithm = 'RMS';
    this.simTime = 24;
    this.currentTick = 0;
    this.timeline = [];
    this.running = null;
    this.readyQueue = [];
    this.jobInstances = [];
    this.contextSwitches = 0;
    this.previousRunning = null;
    this.metrics = {
      cpuUtilization: 0,
      contextSwitches: 0,
      throughput: 0,
      responseTimes: [],
      waitingTimes: [],
      deadlinesMet: 0,
      deadlinesMissed: 0,
      totalJobs: 0
    };
    this.onTick = null;
    this.onComplete = null;
    this.onLog = null;
  }

  addTask(task) {
    const id = this.tasks.length + 1;
    const newTask = {
      id,
      name: task.name,
      execTime: task.execTime,
      period: task.period,
      deadline: task.deadline,
      memory: task.memory || 20,
      priority: 0,
      color: this.getTaskColor(id)
    };
    this.tasks.push(newTask);
    return newTask;
  }

  removeTask(id) {
    this.tasks = this.tasks.filter(t => t.id !== id);
  }

  clearTasks() {
    this.tasks = [];
  }

  getTaskColor(id) {
    const colors = [
      '#6366f1', '#ec4899', '#14b8a6', '#f59e0b',
      '#8b5cf6', '#06b6d4', '#ef4444', '#22c55e'
    ];
    return colors[(id - 1) % colors.length];
  }

  assignPriorities() {
    if (this.algorithm === 'RMS') {
      const sorted = [...this.tasks].sort((a, b) => a.period - b.period);
      sorted.forEach((task, index) => {
        const original = this.tasks.find(t => t.id === task.id);
        original.priority = sorted.length - index;
      });
      this.log('PRIORITY', `RMS: Priorities assigned (shorter period = higher priority)`);
      this.tasks.forEach(t => {
        this.log('PRIORITY', `${t.name}: Priority ${t.priority} (Period: ${t.period})`);
      });
    } else {
      this.tasks.forEach(t => {
        t.priority = 0;
      });
      this.log('PRIORITY', 'EDF: Dynamic priority based on absolute deadline');
    }
  }

  checkSchedulability() {
    let utilization = 0;
    this.tasks.forEach(t => {
      utilization += t.execTime / t.period;
    });

    let schedulable = false;
    let bound = 0;

    if (this.algorithm === 'RMS') {
      const n = this.tasks.length;
      bound = n * (Math.pow(2, 1 / n) - 1);
      schedulable = utilization <= bound;
    } else {
      bound = 1.0;
      schedulable = utilization <= bound;
    }

    return {
      utilization: (utilization * 100).toFixed(2),
      bound: (bound * 100).toFixed(2),
      schedulable,
      algorithm: this.algorithm
    };
  }

  generateJobInstances() {
    this.jobInstances = [];
    this.tasks.forEach(task => {
      for (let release = 0; release < this.simTime; release += task.period) {
        this.jobInstances.push({
          taskId: task.id,
          taskName: task.name,
          releaseTime: release,
          absoluteDeadline: release + task.deadline,
          remainingTime: task.execTime,
          execTime: task.execTime,
          memory: task.memory,
          color: task.color,
          priority: task.priority,
          period: task.period,
          state: 'READY',
          startTime: -1,
          finishTime: -1,
          responseTime: 0,
          waitingTime: 0,
          deadlineMet: true
        });
      }
    });
  }

  selectNextJob(currentTime) {
    const available = this.jobInstances.filter(j =>
      j.releaseTime <= currentTime &&
      j.remainingTime > 0 &&
      (j.state === 'READY' || j.state === 'RUNNING')
    );

    if (available.length === 0) return null;

    if (this.algorithm === 'RMS') {
      available.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return a.absoluteDeadline - b.absoluteDeadline;
      });
    } else {
      available.sort((a, b) => a.absoluteDeadline - b.absoluteDeadline);
    }

    return available[0];
  }

  runSimulation() {
    this.reset();
    this.assignPriorities();
    this.generateJobInstances();

    const schedCheck = this.checkSchedulability();
    this.log('SCHEDULABILITY', `CPU Utilization: ${schedCheck.utilization}% | Bound: ${schedCheck.bound}% | Schedulable: ${schedCheck.schedulable ? 'Yes' : 'No'}`);

    this.timeline = [];
    this.currentTick = 0;

    for (let t = 0; t < this.simTime; t++) {
      this.tick(t);
    }

    this.calculateMetrics();
    if (this.onComplete) this.onComplete(this.getResults());
    return this.getResults();
  }

  async runSimulationAnimated(speed = 5) {
    this.reset();
    this.assignPriorities();
    this.generateJobInstances();

    const schedCheck = this.checkSchedulability();
    this.log('SCHEDULABILITY', `CPU Utilization: ${schedCheck.utilization}% | Bound: ${schedCheck.bound}% | Schedulable: ${schedCheck.schedulable ? 'Yes' : 'No'}`);

    this.timeline = [];
    this.currentTick = 0;
    this.isRunning = true;
    this.isPaused = false;

    const delay = Math.max(50, 600 - speed * 50);

    for (let t = 0; t < this.simTime; t++) {
      while (this.isPaused) {
        await this.sleep(100);
        if (!this.isRunning) return null;
      }
      if (!this.isRunning) return null;

      this.tick(t);
      if (this.onTick) this.onTick(t, this.getSnapshot());
      await this.sleep(delay);
    }

    this.isRunning = false;
    this.calculateMetrics();
    if (this.onComplete) this.onComplete(this.getResults());
    return this.getResults();
  }

  tick(t) {
    this.currentTick = t;

    this.jobInstances.forEach(j => {
      if (j.releaseTime === t && j.remainingTime > 0) {
        j.state = 'READY';
        this.log('RELEASE', `Job ${j.taskName} released at tick ${t} (Deadline: ${j.absoluteDeadline})`);
      }
      if (t >= j.absoluteDeadline && j.remainingTime > 0 && j.state !== 'COMPLETED') {
        j.deadlineMet = false;
        j.state = 'MISSED';
        this.log('DEADLINE', `Job ${j.taskName} MISSED deadline at tick ${t}!`, 'error');
      }
    });

    const nextJob = this.selectNextJob(t);

    if (nextJob) {
      if (this.running && this.running !== nextJob) {
        this.contextSwitches++;
        this.log('CONTEXT_SWITCH', `${this.running.taskName} → ${nextJob.taskName}`, 'warning');
        if (this.running.remainingTime > 0) {
          this.running.state = 'READY';
        }
      } else if (!this.running) {
        if (nextJob.startTime === -1) {
          this.contextSwitches++;
        }
      }

      this.running = nextJob;
      nextJob.state = 'RUNNING';

      if (nextJob.startTime === -1) {
        nextJob.startTime = t;
        nextJob.waitingTime = t - nextJob.releaseTime;
        this.log('DISPATCH', `${nextJob.taskName} dispatched at tick ${t}`);
      }

      nextJob.remainingTime--;

      this.timeline.push({
        tick: t,
        task: nextJob.taskName,
        taskId: nextJob.taskId,
        color: nextJob.color,
        state: 'RUNNING',
        memory: nextJob.memory,
        job: nextJob
      });

      if (nextJob.remainingTime === 0) {
        nextJob.finishTime = t + 1;
        nextJob.state = 'COMPLETED';
        nextJob.responseTime = nextJob.finishTime - nextJob.releaseTime;
        this.log('COMPLETE', `${nextJob.taskName} completed at tick ${t + 1} (Response: ${nextJob.responseTime})`);
        this.running = null;
      }
    } else {
      this.timeline.push({
        tick: t,
        task: 'IDLE',
        taskId: 0,
        color: '#334155',
        state: 'IDLE',
        memory: 0,
        job: null
      });
      if (this.running) {
        this.running = null;
      }
    }
  }

  calculateMetrics() {
    const completed = this.jobInstances.filter(j => j.state === 'COMPLETED');
    const missed = this.jobInstances.filter(j => !j.deadlineMet);
    const busy = this.timeline.filter(t => t.task !== 'IDLE').length;

    this.metrics.cpuUtilization = ((busy / this.simTime) * 100).toFixed(2);
    this.metrics.contextSwitches = this.contextSwitches;
    this.metrics.throughput = completed.length;
    this.metrics.totalJobs = this.jobInstances.length;
    this.metrics.deadlinesMet = completed.filter(j => j.deadlineMet).length;
    this.metrics.deadlinesMissed = missed.length;

    if (completed.length > 0) {
      this.metrics.responseTimes = completed.map(j => j.responseTime);
      this.metrics.waitingTimes = completed.map(j => j.waitingTime);
    }
  }

  getSnapshot() {
    const activeJobs = this.jobInstances.filter(j =>
      j.state === 'RUNNING' || j.state === 'READY'
    ).map(j => ({
      name: j.taskName,
      state: j.state,
      remaining: j.remainingTime,
      deadline: j.absoluteDeadline,
      color: j.color
    }));

    const lastEntry = this.timeline[this.timeline.length - 1];

    return {
      tick: this.currentTick,
      running: lastEntry ? lastEntry.task : 'IDLE',
      activeJobs,
      timeline: [...this.timeline],
      contextSwitches: this.contextSwitches,
      memory: lastEntry ? lastEntry.memory : 0
    };
  }

  getResults() {
    const completed = this.jobInstances.filter(j => j.state === 'COMPLETED');
    const avgResponse = completed.length > 0
      ? (completed.reduce((s, j) => s + j.responseTime, 0) / completed.length).toFixed(2)
      : 0;
    const avgWaiting = completed.length > 0
      ? (completed.reduce((s, j) => s + j.waitingTime, 0) / completed.length).toFixed(2)
      : 0;
    const deadlineRate = this.jobInstances.length > 0
      ? (((this.jobInstances.length - this.metrics.deadlinesMissed) / this.jobInstances.length) * 100).toFixed(1)
      : 100;

    const schedCheck = this.checkSchedulability();

    return {
      timeline: this.timeline,
      metrics: {
        ...this.metrics,
        avgResponseTime: avgResponse,
        avgWaitingTime: avgWaiting,
        deadlineSuccessRate: deadlineRate
      },
      schedulability: schedCheck,
      jobInstances: this.jobInstances,
      tasks: this.tasks,
      algorithm: this.algorithm,
      simTime: this.simTime
    };
  }

  reset() {
    this.currentTick = 0;
    this.timeline = [];
    this.running = null;
    this.readyQueue = [];
    this.jobInstances = [];
    this.contextSwitches = 0;
    this.previousRunning = null;
    this.isRunning = false;
    this.isPaused = false;
    this.metrics = {
      cpuUtilization: 0,
      contextSwitches: 0,
      throughput: 0,
      responseTimes: [],
      waitingTimes: [],
      deadlinesMet: 0,
      deadlinesMissed: 0,
      totalJobs: 0
    };
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
  }

  stop() {
    this.isRunning = false;
    this.isPaused = false;
  }

  log(type, message, level = 'info') {
    if (this.onLog) {
      this.onLog({ type, message, level, tick: this.currentTick });
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

window.RTOSKernel = RTOSKernel;
