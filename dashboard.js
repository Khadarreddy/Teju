/**
 * Performance Monitoring Dashboard Module
 */

class Dashboard {
  constructor() {
    this.cpuChart = null;
    this.memoryChart = null;
    this.cpuData = [];
    this.memoryData = [];
    this.initCharts();
  }

  initCharts() {
    const cpuCtx = document.getElementById('cpuChart');
    const memCtx = document.getElementById('memoryChart');

    if (!cpuCtx || !memCtx) return;

    const chartDefaults = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 200 },
      scales: {
        x: {
          title: { display: true, text: 'Time (ticks)', color: '#94a3b8' },
          ticks: { color: '#94a3b8', maxTicksLimit: 15 },
          grid: { color: 'rgba(148,163,184,0.1)' }
        },
        y: {
          ticks: { color: '#94a3b8' },
          grid: { color: 'rgba(148,163,184,0.1)' }
        }
      },
      plugins: {
        legend: { labels: { color: '#94a3b8' } }
      }
    };

    this.cpuChart = new Chart(cpuCtx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'CPU Active',
          data: [],
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,0.15)',
          fill: true,
          tension: 0.3,
          pointRadius: 2
        }]
      },
      options: {
        ...chartDefaults,
        scales: {
          ...chartDefaults.scales,
          y: { ...chartDefaults.scales.y, min: 0, max: 1, title: { display: true, text: 'Active (0/1)', color: '#94a3b8' } }
        }
      }
    });

    this.memoryChart = new Chart(memCtx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Used (KB)',
            data: [],
            borderColor: '#ec4899',
            backgroundColor: 'rgba(236,72,153,0.15)',
            fill: true,
            tension: 0.3,
            pointRadius: 2
          },
          {
            label: 'Free (KB)',
            data: [],
            borderColor: '#14b8a6',
            backgroundColor: 'rgba(20,184,166,0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 2
          }
        ]
      },
      options: {
        ...chartDefaults,
        scales: {
          ...chartDefaults.scales,
          y: { ...chartDefaults.scales.y, min: 0, title: { display: true, text: 'Memory (KB)', color: '#94a3b8' } }
        }
      }
    });
  }

  updateMetrics(metrics, schedulability) {
    document.getElementById('metricCpu').textContent = metrics.cpuUtilization + '%';
    document.getElementById('cpuBar').style.width = metrics.cpuUtilization + '%';

    document.getElementById('metricContextSwitches').textContent = metrics.contextSwitches;
    document.getElementById('metricThroughput').textContent = metrics.throughput;
    document.getElementById('metricResponse').textContent = metrics.avgResponseTime || '0';
    document.getElementById('metricWaiting').textContent = metrics.avgWaitingTime || '0';
    document.getElementById('metricDeadline').textContent = metrics.deadlineSuccessRate + '%';

    const schedEl = document.getElementById('metricSchedulable');
    if (schedulability) {
      schedEl.textContent = schedulability.schedulable ? 'Yes' : 'No';
      schedEl.className = 'metric-value ' + (schedulability.schedulable ? 'text-success' : 'text-danger');
    }
  }

  updateMemoryMetrics(used, total) {
    document.getElementById('metricMemory').textContent = used + ' / ' + total + ' KB';
    const pct = total > 0 ? ((used / total) * 100).toFixed(1) : 0;
    document.getElementById('memBar').style.width = pct + '%';
  }

  updateCharts(tick, isActive, memUsed, memFree) {
    this.cpuData.push(isActive ? 1 : 0);
    this.memoryData.push({ used: memUsed, free: memFree });

    const labels = this.cpuData.map((_, i) => i);

    if (this.cpuChart) {
      this.cpuChart.data.labels = labels;
      this.cpuChart.data.datasets[0].data = this.cpuData;
      this.cpuChart.update('none');
    }

    if (this.memoryChart) {
      this.memoryChart.data.labels = labels;
      this.memoryChart.data.datasets[0].data = this.memoryData.map(d => d.used);
      this.memoryChart.data.datasets[1].data = this.memoryData.map(d => d.free);
      this.memoryChart.update('none');
    }
  }

  updateProcessStates(processes) {
    const container = document.getElementById('processStates');
    if (!processes || processes.length === 0) {
      container.innerHTML = '<p class="empty-state">No active processes</p>';
      return;
    }

    const stateIcons = {
      READY: '⏳', RUNNING: '▶️', WAITING: '💤',
      COMPLETED: '✅', MISSED: '❌', IDLE: '⏸️'
    };

    let html = '';
    processes.forEach(p => {
      const stateClass = p.state.toLowerCase();
      html += `<div class="process-item">
        <span class="process-color" style="background:${p.color}"></span>
        <span class="process-name">${p.name}</span>
        <span class="process-state state-${stateClass}">${stateIcons[p.state] || ''} ${p.state}</span>
      </div>`;
    });
    container.innerHTML = html;
  }

  generateReport(results) {
    const { metrics, schedulability, algorithm, simTime, tasks, jobInstances } = results;
    const missed = jobInstances.filter(j => !j.deadlineMet);

    let html = `<div class="report-section">
      <h3>Simulation Summary</h3>
      <table class="report-table">
        <tr><td>Algorithm</td><td><strong>${algorithm}</strong></td></tr>
        <tr><td>Simulation Time</td><td>${simTime} ticks</td></tr>
        <tr><td>Total Tasks</td><td>${tasks.length}</td></tr>
        <tr><td>Total Jobs</td><td>${metrics.totalJobs}</td></tr>
        <tr><td>Schedulable</td><td class="${schedulability.schedulable ? 'text-success' : 'text-danger'}">${schedulability.schedulable ? 'Yes' : 'No'} (${schedulability.utilization}% / ${schedulability.bound}%)</td></tr>
      </table>
    </div>`;

    html += `<div class="report-section">
      <h3>Performance Metrics</h3>
      <table class="report-table">
        <tr><td>CPU Utilization</td><td>${metrics.cpuUtilization}%</td></tr>
        <tr><td>Context Switches</td><td>${metrics.contextSwitches}</td></tr>
        <tr><td>Throughput</td><td>${metrics.throughput} jobs completed</td></tr>
        <tr><td>Avg Response Time</td><td>${metrics.avgResponseTime} ticks</td></tr>
        <tr><td>Avg Waiting Time</td><td>${metrics.avgWaitingTime} ticks</td></tr>
        <tr><td>Deadline Success Rate</td><td>${metrics.deadlineSuccessRate}%</td></tr>
      </table>
    </div>`;

    if (missed.length > 0) {
      html += `<div class="report-section">
        <h3>Missed Deadlines</h3>
        <table class="report-table">
          <tr><th>Task</th><th>Release</th><th>Deadline</th></tr>`;
      missed.forEach(j => {
        html += `<tr><td>${j.taskName}</td><td>${j.releaseTime}</td><td>${j.absoluteDeadline}</td></tr>`;
      });
      html += '</table></div>';
    } else {
      html += `<div class="report-section report-success">
        <h3>All deadlines met. System Schedulable: Yes</h3>
      </div>`;
    }

    document.getElementById('reportContent').innerHTML = html;
    document.getElementById('btnExport').disabled = false;
    this.lastReport = results;
  }

  exportReport() {
    if (!this.lastReport) return;

    const { metrics, schedulability, algorithm, simTime, tasks, timeline } = this.lastReport;
    let text = '=== RTOS KERNEL SIMULATOR - PERFORMANCE REPORT ===\n\n';
    text += `Algorithm: ${algorithm}\n`;
    text += `Simulation Time: ${simTime} ticks\n`;
    text += `Tasks: ${tasks.map(t => t.name).join(', ')}\n\n`;
    text += '--- Metrics ---\n';
    text += `CPU Utilization: ${metrics.cpuUtilization}%\n`;
    text += `Context Switches: ${metrics.contextSwitches}\n`;
    text += `Throughput: ${metrics.throughput}\n`;
    text += `Avg Response Time: ${metrics.avgResponseTime}\n`;
    text += `Avg Waiting Time: ${metrics.avgWaitingTime}\n`;
    text += `Deadline Success Rate: ${metrics.deadlineSuccessRate}%\n`;
    text += `Schedulable: ${schedulability.schedulable ? 'Yes' : 'No'}\n\n`;
    text += '--- Timeline ---\n';
    text += timeline.map(t => `Tick ${t.tick}: ${t.task}`).join('\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rtos_simulation_report.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  addLogEntry(log) {
    const container = document.getElementById('kernelLog');
    const levelClass = log.level === 'error' ? 'log-error' : log.level === 'warning' ? 'log-warning' : 'log-info';
    const entry = document.createElement('div');
    entry.className = `log-entry ${levelClass}`;
    entry.innerHTML = `<span class="log-tick">[T${log.tick}]</span> <span class="log-type">[${log.type}]</span> ${log.message}`;
    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;
  }

  clearLog() {
    document.getElementById('kernelLog').innerHTML =
      '<div class="log-entry log-info">[KERNEL] RTOS Simulator initialized. Ready for task scheduling.</div>';
  }

  reset() {
    this.cpuData = [];
    this.memoryData = [];
    if (this.cpuChart) {
      this.cpuChart.data.labels = [];
      this.cpuChart.data.datasets[0].data = [];
      this.cpuChart.update();
    }
    if (this.memoryChart) {
      this.memoryChart.data.labels = [];
      this.memoryChart.data.datasets.forEach(d => d.data = []);
      this.memoryChart.update();
    }
    this.updateMetrics({
      cpuUtilization: 0, contextSwitches: 0, throughput: 0,
      avgResponseTime: 0, avgWaitingTime: 0, deadlineSuccessRate: 100
    }, null);
    this.updateMemoryMetrics(0, 50);
    document.getElementById('processStates').innerHTML = '<p class="empty-state">No active processes</p>';
    document.getElementById('reportContent').innerHTML = '<p class="empty-state">Run simulation to generate report</p>';
    document.getElementById('btnExport').disabled = true;
  }
}

window.Dashboard = Dashboard;
