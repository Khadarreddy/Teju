/**
 * Gantt Chart Visualization Module
 */

class GanttChart {
  constructor(containerId, legendId) {
    this.container = document.getElementById(containerId);
    this.legendContainer = document.getElementById(legendId);
    this.taskColors = {};
  }

  render(timeline, tasks) {
    if (!timeline || timeline.length === 0) {
      this.container.innerHTML = '<p class="empty-state">Start simulation to view timeline</p>';
      return;
    }

    const taskNames = [...new Set(timeline.map(t => t.task))].filter(t => t !== 'IDLE');
    taskNames.push('IDLE');

    tasks.forEach(t => {
      this.taskColors[t.name] = t.color;
    });
    this.taskColors['IDLE'] = '#1e293b';

    const rowHeight = 40;
    const cellWidth = Math.max(28, Math.min(50, 800 / timeline.length));
    const labelWidth = 60;
    const chartWidth = labelWidth + timeline.length * cellWidth;
    const chartHeight = taskNames.length * rowHeight + 30;

    let html = `<div class="gantt-wrapper" style="min-width:${chartWidth}px">`;

    html += '<div class="gantt-header">';
    html += `<div class="gantt-label-col" style="width:${labelWidth}px"></div>`;
    html += '<div class="gantt-time-axis">';
    for (let i = 0; i < timeline.length; i++) {
      html += `<span class="gantt-tick" style="width:${cellWidth}px">${i}</span>`;
    }
    html += '</div></div>';

    taskNames.forEach(taskName => {
      html += '<div class="gantt-row">';
      html += `<div class="gantt-label" style="width:${labelWidth}px">${taskName}</div>`;
      html += '<div class="gantt-cells">';

      for (let i = 0; i < timeline.length; i++) {
        const entry = timeline[i];
        const isActive = entry.task === taskName;
        const color = isActive ? (entry.color || this.taskColors[taskName]) : 'transparent';
        const cls = isActive ? 'gantt-cell active' : 'gantt-cell';
        const title = isActive
          ? `${taskName} @ tick ${i} (${entry.state})`
          : `Tick ${i}`;

        html += `<div class="${cls}" style="width:${cellWidth}px;background:${isActive ? color : 'transparent'}" title="${title}">`;
        if (isActive) html += '<span class="cell-label">' + taskName + '</span>';
        html += '</div>';
      }

      html += '</div></div>';
    });

    html += '</div>';
    this.container.innerHTML = html;
    this.renderLegend(tasks);
  }

  renderAnimated(timeline, tasks, currentTick) {
    const partial = timeline.slice(0, currentTick + 1);
    this.render(partial, tasks);

    const cells = this.container.querySelectorAll('.gantt-cell.active');
    if (cells.length > 0) {
      const lastCell = cells[cells.length - 1];
      lastCell.classList.add('gantt-cell-current');
    }
  }

  renderLegend(tasks) {
    if (!this.legendContainer) return;

    let html = '<div class="legend-items">';
    tasks.forEach(t => {
      html += `<span class="legend-item"><span class="legend-color" style="background:${t.color}"></span>${t.name} (P:${t.period}, C:${t.execTime})</span>`;
    });
    html += '<span class="legend-item"><span class="legend-color" style="background:#1e293b"></span>IDLE</span>';
    html += '</div>';
    this.legendContainer.innerHTML = html;
  }

  clear() {
    this.container.innerHTML = '<p class="empty-state">Start simulation to view timeline</p>';
    if (this.legendContainer) this.legendContainer.innerHTML = '';
  }
}

window.GanttChart = GanttChart;
