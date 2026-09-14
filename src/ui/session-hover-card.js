import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { formatDuration, formatMemory } from '../orca/session-resources.js';

const CARD_GAP = 8;
const MAX_TEXT_LENGTH = 240;

const STATUS_LABELS = Object.freeze({
  question: 'Pregunta pendiente',
  attention: 'Requiere atención',
  working: 'Trabajando',
  finished: 'Finalizado',
});

function shortened(value) {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ');
  return text.length > MAX_TEXT_LENGTH
    ? `${text.slice(0, MAX_TEXT_LENGTH - 1)}…`
    : text;
}

function formatDate(timestamp) {
  if (!Number.isFinite(timestamp))
    return null;
  const date = GLib.DateTime.new_from_unix_local(Math.floor(timestamp / 1000));
  return `hace ${formatDuration(Date.now() - timestamp)} · ${date.format('%d %b, %H:%M')}`;
}

export class SessionHoverCard {
  constructor(extension) {
    this._extension = extension;
    this._token = 0;
    this._positionId = 0;
    this._anchor = null;
    this.actor = new St.BoxLayout({
      vertical: true,
      reactive: false,
      can_focus: false,
      visible: false,
      style_class: 'orca-session-card',
    });
    Main.uiGroup.add_child(this.actor);
  }

  show(agent, anchor) {
    const token = ++this._token;
    this._anchor = anchor;
    this.actor.remove_all_children();
    this.actor.accessible_name = `Detalles de ${agent.name}`;

    const header = new St.BoxLayout({ style_class: 'orca-session-card-header' });
    header.add_child(new St.Label({
      text: agent.name,
      x_expand: true,
      style_class: 'orca-session-card-title',
    }));
    header.add_child(new St.Label({
      text: STATUS_LABELS[agent.status] ?? agent.status,
      style_class: `orca-session-card-status orca-status-${agent.status}`,
    }));
    this.actor.add_child(header);

    const identity = [agent.type, agent.model].filter(Boolean).join(' · ');
    if (identity)
      this.actor.add_child(this._label(identity, 'orca-session-card-muted'));
    this._addTextBlock('Último prompt', agent.prompt, agent.updatedAt);
    this._addTextBlock('Última respuesta', agent.lastAssistantMessage, agent.updatedAt);

    this._resources = new St.BoxLayout({
      style_class: 'orca-session-card-resources',
    });
    this._resources.add_child(this._label(
      'Consultando recursos…',
      'orca-session-card-muted',
    ));
    this.actor.add_child(this._resources);

    if (agent.toolName)
      this.actor.add_child(this._detail('tool-symbolic.svg', 'Herramienta', agent.toolName));
    const stateDuration = Number.isFinite(agent.stateStartedAt)
      ? formatDuration(Date.now() - agent.stateStartedAt)
      : null;
    if (stateDuration)
      this.actor.add_child(this._detail('clock-symbolic.svg', 'En este estado', stateDuration));
    const activity = formatDate(agent.updatedAt);
    if (activity)
      this.actor.add_child(this._detail('clock-symbolic.svg', 'Actividad', activity));

    this.actor.opacity = 0;
    this.actor.show();
    this._queuePosition();
    return token;
  }

  setResources(token, resources, failed = false) {
    if (token !== this._token || !this.actor.visible)
      return;

    this._resources.remove_all_children();
    if (failed || !resources) {
      this._resources.add_child(this._label(
        'Recursos no disponibles',
        'orca-session-card-muted',
      ));
      return;
    }

    const values = [
      ['cpu-symbolic.svg', 'CPU', Number.isFinite(resources.cpu)
        ? `${resources.cpu.toFixed(1)} %`
        : null],
      ['memory-symbolic.svg', resources.memoryMetric?.toUpperCase() || 'Memoria',
        formatMemory(resources.memory)],
      ['process-symbolic.svg', 'PID', Number.isFinite(resources.pid)
        ? String(resources.pid)
        : null],
    ];
    for (const [icon, label, value] of values) {
      if (value)
        this._resources.add_child(this._resource(icon, label, value));
    }
    const measuredAt = formatDate(resources.collectedAt);
    if (measuredAt)
      this.actor.add_child(this._detail('clock-symbolic.svg', 'Medición', measuredAt));
    this._queuePosition();
  }

  hide() {
    this._token++;
    this._anchor = null;
    if (this._positionId) {
      GLib.source_remove(this._positionId);
      this._positionId = 0;
    }
    this.actor.hide();
  }

  destroy() {
    this.hide();
    this.actor.destroy();
  }

  _addTextBlock(title, value, timestamp) {
    const text = shortened(value);
    if (!text)
      return;
    const header = new St.BoxLayout({
      style_class: 'orca-session-card-section-header',
    });
    const titleLabel = this._label(title, 'orca-session-card-section-title');
    titleLabel.x_expand = true;
    header.add_child(titleLabel);
    const date = formatDate(timestamp);
    if (date)
      header.add_child(this._label(date, 'orca-session-card-section-date'));
    this.actor.add_child(header);
    const label = this._label(text, 'orca-session-card-text');
    label.clutter_text.set_line_wrap(true);
    this.actor.add_child(label);
  }

  _label(text, styleClass) {
    return new St.Label({
      text: String(text),
      style_class: styleClass,
      y_align: Clutter.ActorAlign.CENTER,
    });
  }

  _icon(filename) {
    return new St.Icon({
      gicon: Gio.icon_new_for_string(`${this._extension.path}/assets/${filename}`),
      style_class: 'orca-session-card-icon',
      y_align: Clutter.ActorAlign.CENTER,
    });
  }

  _resource(icon, label, value) {
    const box = new St.BoxLayout({ style_class: 'orca-session-card-resource' });
    box.add_child(this._icon(icon));
    box.add_child(this._label(`${label} ${value}`, 'orca-session-card-resource-text'));
    return box;
  }

  _detail(icon, label, value) {
    const box = new St.BoxLayout({ style_class: 'orca-session-card-detail' });
    box.add_child(this._icon(icon));
    box.add_child(this._label(`${label}: ${value}`, 'orca-session-card-muted'));
    return box;
  }

  _queuePosition() {
    if (this._positionId)
      GLib.source_remove(this._positionId);
    this._positionId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
      this._positionId = 0;
      this._position();
      return GLib.SOURCE_REMOVE;
    });
  }

  _position() {
    if (!this._anchor || !this.actor.visible)
      return;
    const monitor = Main.layoutManager.findMonitorForActor(this._anchor) ??
      Main.layoutManager.primaryMonitor;
    const [anchorX, anchorY] = this._anchor.get_transformed_position();
    const [anchorWidth] = this._anchor.get_transformed_size();
    const [, cardWidth] = this.actor.get_preferred_width(-1);
    const [, cardHeight] = this.actor.get_preferred_height(cardWidth);
    let x = anchorX + anchorWidth + CARD_GAP;
    if (x + cardWidth > monitor.x + monitor.width)
      x = anchorX - cardWidth - CARD_GAP;
    x = Math.max(monitor.x, Math.min(x, monitor.x + monitor.width - cardWidth));
    const y = Math.max(
      monitor.y,
      Math.min(anchorY, monitor.y + monitor.height - cardHeight),
    );
    this.actor.set_position(Math.round(x), Math.round(y));
    this.actor.opacity = 255;
  }
}
