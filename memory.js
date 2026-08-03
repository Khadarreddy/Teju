/**
 * Process & Memory Manager Module
 */

class MemoryManager {
  constructor(totalMemory = 50) {
    this.totalMemory = totalMemory;
    this.allocated = {};
    this.history = [];
  }

  setTotalMemory(total) {
    this.totalMemory = total;
  }

  allocate(taskName, amount) {
    const currentUsed = this.getUsedMemory();
    if (currentUsed + amount > this.totalMemory) {
      return { success: false, error: 'Insufficient memory' };
    }
    this.allocated[taskName] = amount;
    return { success: true, used: this.getUsedMemory(), free: this.getFreeMemory() };
  }

  deallocate(taskName) {
    if (this.allocated[taskName]) {
      delete this.allocated[taskName];
    }
    return { used: this.getUsedMemory(), free: this.getFreeMemory() };
  }

  getUsedMemory() {
    return Object.values(this.allocated).reduce((sum, val) => sum + val, 0);
  }

  getFreeMemory() {
    return this.totalMemory - this.getUsedMemory();
  }

  getUtilization() {
    return ((this.getUsedMemory() / this.totalMemory) * 100).toFixed(1);
  }

  processTimelineEntry(entry) {
    const snapshot = { tick: entry.tick, task: entry.task };

    if (entry.task !== 'IDLE' && entry.memory > 0) {
      this.allocate(entry.task, entry.memory);
    }

    snapshot.allocated = { ...this.allocated };
    snapshot.used = this.getUsedMemory();
    snapshot.free = this.getFreeMemory();
    snapshot.utilization = this.getUtilization();

    if (entry.job && entry.job.remainingTime === 0) {
      this.deallocate(entry.task);
      snapshot.deallocated = entry.task;
    }

    this.history.push(snapshot);
    return snapshot;
  }

  processFullTimeline(timeline) {
    this.reset();
    return timeline.map(entry => this.processTimelineEntry(entry));
  }

  reset() {
    this.allocated = {};
    this.history = [];
  }

  getMemoryTimeline() {
    return this.history.map(h => ({
      tick: h.tick,
      used: h.used,
      free: h.free,
      utilization: parseFloat(h.utilization)
    }));
  }
}

class ProcessManager {
  constructor() {
    this.processes = [];
  }

  updateFromSnapshot(snapshot, tasks) {
    this.processes = tasks.map(task => {
      const activeJob = snapshot.activeJobs.find(j => j.name === task.name);
      let state = 'WAITING';
      if (activeJob) {
        state = activeJob.state;
      } else {
        const hasCompleted = snapshot.timeline.some(
          t => t.task === task.name && t.tick === snapshot.tick
        );
        if (hasCompleted) state = 'RUNNING';
      }
      return {
        id: task.id,
        name: task.name,
        state,
        color: task.color,
        priority: task.priority,
        period: task.period,
        execTime: task.execTime,
        remaining: activeJob ? activeJob.remaining : 0
      };
    });
    return this.processes;
  }

  getStateCounts() {
    const counts = { READY: 0, RUNNING: 0, WAITING: 0, COMPLETED: 0, MISSED: 0 };
    this.processes.forEach(p => {
      if (counts[p.state] !== undefined) counts[p.state]++;
    });
    return counts;
  }
}

window.MemoryManager = MemoryManager;
window.ProcessManager = ProcessManager;
