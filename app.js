/**
 * Main Application Controller
 */

class RTOSApp {
  constructor() {
    this.kernel = new RTOSKernel();
    this.memoryManager = new MemoryManager(50);
    this.processManager = new ProcessManager();
    this.dashboard = new Dashboard();
    this.gantt = new GanttChart('ganttChart', 'ganttLegend');

    this.kernel.onLog = (log) => this.dashboard.addLogEntry(log);
    this.kernel.onTick = (tick, snapshot) => this.onSimulationTick(tick, snapshot);
    this.kernel.onComplete = (results) => this.onSimulationComplete(results);

    this.bindEvents();
    this.renderTaskList();
  }

  bindEvents() {
    document.getElementById('taskForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.addTask();
    });

    document.getElementById('btnStart').addEventListener('click', () => this.startSimulation());
    document.getElementById('btnPause').addEventListener('click', () => this.togglePause());
    document.getElementById('btnReset').addEventListener('click', () => this.resetSimulation());
    document.getElementById('btnLoadSample').addEventListener('click', () => this.loadSampleTasks());
    document.getElementById('btnExport').addEventListener('click', () => this.dashboard.exportReport());

    document.getElementById('algorithm').addEventListener('change', (e) => {
      this.kernel.algorithm = e.target.value;
    });

    document.getElementById('simTime').addEventListener('change', (e) => {
      this.kernel.simTime = parseInt(e.target.value) || 24;
    });

    document.getElementById('totalMemory').addEventListener('change', (e) => {
      const total = parseInt(e.target.value) || 50;
      this.memoryManager.setTotalMemory(total);
    });
  }

  addTask() {
    const name = document.getElementById('taskName').value.trim();
    const execTime = parseInt(document.getElementById('execTime').value);
    const period = parseInt(document.getElementById('period').value);
    const deadline = parseInt(document.getElementById('deadline').value);
    const memory = parseInt(document.getElementById('memoryReq').value);

    if (!name) return;
    if (this.kernel.tasks.some(t => t.name === name)) {
      alert('Task name already exists!');
      return;
    }
    if (deadline > period) {
      alert('Deadline should not exceed period!');
      return;
    }
    if (execTime > deadline) {
      alert('Execution time cannot exceed deadline!');
      return;
    }

    this.kernel.addTask({ name, execTime, period, deadline, memory });
    this.renderTaskList();
    document.getElementById('taskForm').reset();
    document.getElementById('execTime').value = 1;
    document.getElementById('period').value = 4;
    document.getElementById('deadline').value = 4;
    document.getElementById('memoryReq').value = 20;

    this.dashboard.addLogEntry({
      type: 'TASK', message: `Task ${name} added (C=${execTime}, P=${period}, D=${deadline}, M=${memory}KB)`,
      level: 'info', tick: 0
    });
  }

  removeTask(id) {
    const task = this.kernel.tasks.find(t => t.id === id);
    this.kernel.removeTask(id);
    this.renderTaskList();
    if (task) {
      this.dashboard.addLogEntry({
        type: 'TASK', message: `Task ${task.name} removed`, level: 'info', tick: 0
      });
    }
  }

  renderTaskList() {
    const container = document.getElementById('taskList');
    if (this.kernel.tasks.length === 0) {
      container.innerHTML = '<p class="empty-state">No tasks added yet</p>';
      return;
    }

    let html = '';
    this.kernel.tasks.forEach(task => {
      html += `<div class="task-item">
        <span class="task-color" style="background:${task.color}"></span>
        <div class="task-info">
          <strong>${task.name}</strong>
          <span class="task-details">C:${task.execTime} P:${task.period} D:${task.deadline} M:${task.memory}KB</span>
        </div>
        <button class="btn-icon btn-remove" onclick="app.removeTask(${task.id})" title="Remove">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`;
    });
    container.innerHTML = html;
  }

  loadSampleTasks() {
    this.kernel.clearTasks();
    const samples = [
      { name: 'T1', execTime: 1, period: 4, deadline: 4, memory: 20 },
      { name: 'T2', execTime: 2, period: 6, deadline: 6, memory: 15 },
      { name: 'T3', execTime: 3, period: 12, deadline: 12, memory: 10 }
    ];
    samples.forEach(s => this.kernel.addTask(s));
    this.renderTaskList();
    this.dashboard.addLogEntry({
      type: 'TASK', message: 'Sample tasks loaded (T1, T2, T3)', level: 'info', tick: 0
    });
  }

  async startSimulation() {
    if (this.kernel.tasks.length === 0) {
      alert('Please add at least one task before starting!');
      return;
    }

    this.kernel.algorithm = document.getElementById('algorithm').value;
    this.kernel.simTime = parseInt(document.getElementById('simTime').value) || 24;
    this.memoryManager.setTotalMemory(parseInt(document.getElementById('totalMemory').value) || 50);

    const speed = parseInt(document.getElementById('simSpeed').value) || 5;

    this.dashboard.reset();
    this.dashboard.clearLog();
    this.gantt.clear();
    this.memoryManager.reset();

    this.setSimStatus('Running', 'running');
    document.getElementById('btnStart').disabled = true;
    document.getElementById('btnPause').disabled = false;

    this.dashboard.addLogEntry({
      type: 'KERNEL', message: `Starting ${this.kernel.algorithm} simulation for ${this.kernel.simTime} ticks`,
      level: 'info', tick: 0
    });

    await this.kernel.runSimulationAnimated(speed);

    document.getElementById('btnStart').disabled = false;
    document.getElementById('btnPause').disabled = true;
  }

  onSimulationTick(tick, snapshot) {
    document.getElementById('currentTick').textContent = tick;

    this.gantt.renderAnimated(snapshot.timeline, this.kernel.tasks, tick);

    const isActive = snapshot.running !== 'IDLE' ? 1 : 0;
    const memSnapshot = this.memoryManager.processTimelineEntry(snapshot.timeline[tick]);
    this.dashboard.updateCharts(tick, isActive, memSnapshot.used, memSnapshot.free);
    this.dashboard.updateMemoryMetrics(memSnapshot.used, this.memoryManager.totalMemory);

    const processes = this.processManager.updateFromSnapshot(snapshot, this.kernel.tasks);
    this.dashboard.updateProcessStates(processes);

    document.getElementById('metricContextSwitches').textContent = snapshot.contextSwitches;
  }

  onSimulationComplete(results) {
    this.setSimStatus('Completed', 'completed');
    document.getElementById('btnStart').disabled = false;
    document.getElementById('btnPause').disabled = true;

    this.gantt.render(results.timeline, results.tasks);
    this.dashboard.updateMetrics(results.metrics, results.schedulability);
    this.dashboard.generateReport(results);

    const memHistory = this.memoryManager.processFullTimeline(results.timeline);
    if (memHistory.length > 0) {
      const lastMem = memHistory[memHistory.length - 1];
      this.dashboard.updateMemoryMetrics(lastMem.used, this.memoryManager.totalMemory);
    }

    this.dashboard.addLogEntry({
      type: 'KERNEL',
      message: `Simulation complete. CPU: ${results.metrics.cpuUtilization}%, Deadlines met: ${results.metrics.deadlineSuccessRate}%`,
      level: 'info', tick: results.simTime
    });
  }

  togglePause() {
    if (this.kernel.isPaused) {
      this.kernel.resume();
      this.setSimStatus('Running', 'running');
      document.getElementById('btnPause').innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause';
    } else {
      this.kernel.pause();
      this.setSimStatus('Paused', 'paused');
      document.getElementById('btnPause').innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Resume';
    }
  }

  resetSimulation() {
    this.kernel.stop();
    this.kernel.reset();
    this.memoryManager.reset();
    this.dashboard.reset();
    this.dashboard.clearLog();
    this.gantt.clear();
    this.renderTaskList();

    document.getElementById('currentTick').textContent = '0';
    document.getElementById('btnStart').disabled = false;
    document.getElementById('btnPause').disabled = true;
    document.getElementById('btnPause').innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause';
    this.setSimStatus('Idle', 'idle');
  }

  setSimStatus(text, cls) {
    const el = document.getElementById('simStatus');
    el.textContent = text;
    el.className = 'status-badge status-' + cls;
  }
}

const app = new RTOSApp();
