import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as Dialog from 'resource:///org/gnome/shell/ui/dialog.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {
  AGENT_STATUS,
  requiresCloseConfirmation,
} from '../orca/status-model.js';
import { SessionHoverCard } from './session-hover-card.js';

const PRESENTATION = Object.freeze({
  [AGENT_STATUS.QUESTION]: ['❓', 'Pregunta pendiente', 'orca-status-question'],
  [AGENT_STATUS.ATTENTION]: ['🔔', 'Requiere atención', 'orca-status-attention'],
  [AGENT_STATUS.WORKING]: ['●', 'Trabajando', 'orca-status-working'],
  [AGENT_STATUS.FINISHED]: ['●', 'Finalizado', 'orca-status-finished'],
  unavailable: ['●', 'Orca no disponible', 'orca-status-unavailable'],
});
const AGENT_ICONS = Object.freeze({
  claude: ['claude-symbolic.svg', 'Agente Claude'],
  codex: ['openai-symbolic.svg', 'Agente Codex'],
});

export const OrcaIndicator = GObject.registerClass({
  GTypeName: 'OrcaDevStatusIndicator',
},
class OrcaIndicator extends PanelMenu.Button {
  _init(
    extension,
    onRefresh,
    onOpenOrca,
    onOpenAgent,
    onCloseAgent,
    onCreateAgent,
    onLoadSessionResources,
    onLoadSessionDetails,
  ) {
    super._init(0.5, extension.metadata.name, false);

    this._box = new St.BoxLayout({
      style_class: 'orca-status-panel',
      y_align: Clutter.ActorAlign.CENTER,
    });
    this._countLabel = new St.Label({
      text: '🐋 0',
      y_align: Clutter.ActorAlign.CENTER,
    });
    this._statusLabel = new St.Label({
      text: '●',
      style_class: 'orca-status-icon orca-status-unavailable',
      y_align: Clutter.ActorAlign.CENTER,
    });
    this._box.add_child(this._countLabel);
    this._box.add_child(this._statusLabel);
    this.add_child(this._box);
    this._extension = extension;
    this._onRefresh = onRefresh;
    this._onOpenOrca = onOpenOrca;
    this._onOpenAgent = onOpenAgent;
    this._onCloseAgent = onCloseAgent;
    this._onCreateAgent = onCreateAgent;
    this._onLoadSessionResources = onLoadSessionResources;
    this._onLoadSessionDetails = onLoadSessionDetails;
    this._hoverTimeoutId = 0;
    this._hoverCard = new SessionHoverCard(extension);
    this._menuOpen = false;
    this._pendingMenuUpdate = null;
    this.menu.connect('open-state-changed', (_menu, open) => {
      this._menuOpen = open;
      if (open) {
        return;
      }

      this._cancelHover();

      if (this._pendingMenuUpdate) {
        const { snapshot, updatedAt } = this._pendingMenuUpdate;
        this._pendingMenuUpdate = null;
        this._renderMenu(snapshot, updatedAt);
      }
    });
    this.connect('destroy', () => {
      this._cancelHover();
      this._hoverCard?.destroy();
      this._hoverCard = null;
    });
    this.update({ available: false, totalCount: 0, status: null });
  }

  update(snapshot, updatedAt = null, refreshOpenMenu = false) {
    const [icon, label, styleClass] =
      PRESENTATION[snapshot.status ?? 'unavailable'];
    const priorityCount = snapshot.counts?.[snapshot.status] ?? 0;
    this._countLabel.text = `🐋 ${priorityCount}`;
    this._statusLabel.text = icon;
    this._statusLabel.set_style_class_name(`orca-status-icon ${styleClass}`);
    this.accessible_name =
      `Orca: ${priorityCount} agentes. ${label}`;

    // Rebuilding PopupMenu items while it is open destroys the item under
    // the pointer and also hides the hover card. Apply the newest snapshot
    // after the menu closes instead.
    if (this._menuOpen && !refreshOpenMenu) {
      this._pendingMenuUpdate = { snapshot, updatedAt };
      return;
    }

    this._pendingMenuUpdate = null;
    this._renderMenu(snapshot, updatedAt);
  }

  _renderMenu(snapshot, updatedAt) {
    this._cancelHover();
    this.menu.removeAll();

    if (!snapshot.available) {
      const unavailableRow = new PopupMenu.PopupBaseMenuItem({
        reactive: false,
        can_focus: false,
      });
      unavailableRow.add_child(new St.Label({
        text: 'Orca no disponible',
        x_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
      }));
      const openButton = new St.Button({
        label: 'Abrir Orca IDE',
        style_class: 'button',
        can_focus: true,
      });
      openButton.connect('clicked', () => this._openOrca());
      unavailableRow.add_child(openButton);
      this.menu.addMenuItem(unavailableRow);
    } else {
      const summary = new PopupMenu.PopupMenuItem(
        `Resumen global · ${snapshot.activeCount} activos · ` +
        `${snapshot.counts.finished} finalizados`,
        { reactive: false, can_focus: false },
      );
      summary.add_style_class_name('orca-status-summary');
      this.menu.addMenuItem(summary);

      const totals = new PopupMenu.PopupBaseMenuItem({
        reactive: false,
        can_focus: false,
      });
      totals.add_style_class_name('orca-status-totals');
      for (const [icon, count] of [
        ['❓', snapshot.counts.question],
        ['🔔', snapshot.counts.attention],
        ['🟠', snapshot.counts.working],
        ['🟢', snapshot.counts.finished],
      ]) {
        const total = new St.BoxLayout({
          style_class: 'orca-status-total',
          y_align: Clutter.ActorAlign.CENTER,
        });
        total.add_child(new St.Label({
          text: icon,
          style_class: 'orca-status-total-icon',
          y_align: Clutter.ActorAlign.CENTER,
        }));
        total.add_child(new St.Label({
          text: String(count),
          y_align: Clutter.ActorAlign.CENTER,
        }));
        totals.add_child(total);
      }
      this.menu.addMenuItem(totals);

      for (const workspace of snapshot.workspaces) {
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const heading = new PopupMenu.PopupBaseMenuItem({
          reactive: false,
          can_focus: false,
        });
        heading.add_style_class_name('orca-status-workspace');
        heading.add_child(new St.Label({
          text: workspace.name,
          x_expand: true,
        }));
        const createButton = new St.Button({
          child: new St.Icon({ icon_name: 'list-add-symbolic' }),
          style_class: 'orca-close-button',
          can_focus: true,
          accessible_name:
            `Crear sesión ${workspace.latestAgentType} en ${workspace.name}`,
        });
        createButton.connect('clicked', () =>
          this._createAgent(workspace, createButton));
        heading.add_child(createButton);
        this.menu.addMenuItem(heading);

        for (const agent of workspace.agents) {
          const target = { ...agent, worktreeId: workspace.id };
          const agentIcon = AGENT_ICONS[agent.type];
          const item = new PopupMenu.PopupBaseMenuItem({
            reactive: true,
            can_focus: true,
          });
          item.accessible_name = `Abrir ${agent.name} en Orca`;
          item.add_child(agentIcon
            ? new St.Icon({
                gicon: Gio.icon_new_for_string(
                  `${this._extension.path}/assets/${agentIcon[0]}`,
                ),
                style_class: 'orca-agent-icon',
                accessible_name: agentIcon[1],
                y_align: Clutter.ActorAlign.CENTER,
              })
            : new St.Label({
                text: '🤖',
                style_class: 'orca-agent-icon',
                accessible_name: `Agente ${agent.type}`,
                y_align: Clutter.ActorAlign.CENTER,
              }));
          item.add_child(new St.Label({
            text: agent.name,
            x_expand: true,
          }));
          const [icon, accessibleName, styleClass] = PRESENTATION[agent.status];
          item.add_child(new St.Label({
            text: icon,
            style_class: styleClass,
            accessible_name: accessibleName,
          }));
          const closeButton = new St.Button({
            child: new St.Icon({ icon_name: 'window-close-symbolic' }),
            style_class: 'orca-close-button',
            can_focus: true,
            accessible_name: `Cerrar ${agent.name}`,
          });
          closeButton.connect('clicked', () =>
            this._requestClose(target, closeButton));
          item.connect('activate', (_item, event) => {
            const actor = event && global.stage.get_event_actor(event);
            if (!actor || !closeButton.contains(actor))
              this._openAgent(target);
          });
          item.connect('enter-event', () => {
            this._scheduleHover(target, item);
            return Clutter.EVENT_PROPAGATE;
          });
          item.connect('leave-event', () => {
            this._cancelHover();
            return Clutter.EVENT_PROPAGATE;
          });
          item.add_child(closeButton);
          this.menu.addMenuItem(item);
        }
      }
    }

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    const refreshRow = new PopupMenu.PopupBaseMenuItem({
      reactive: false,
      can_focus: false,
    });
    refreshRow.add_style_class_name('orca-refresh-row');
    const refreshButton = new St.Button({
      label: '↻ Refrescar',
      style_class: 'button',
      can_focus: true,
    });
    refreshButton.connect('clicked', () => this._onRefresh());
    refreshRow.add_child(refreshButton);
    refreshRow.add_child(new St.Label({
      text: `Actualizado: ${updatedAt ?? '--:--:--'}`,
      style_class: 'orca-refresh-time',
      x_expand: true,
      x_align: Clutter.ActorAlign.END,
      y_align: Clutter.ActorAlign.CENTER,
    }));
    this.menu.addMenuItem(refreshRow);

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    this.menu.addAction('Configuración', () => this._extension.openPreferences());
  }

  _scheduleHover(agent, item) {
    this._cancelHover();
    this._hoverTimeoutId = GLib.timeout_add(
      GLib.PRIORITY_DEFAULT,
      250,
      () => {
        this._hoverTimeoutId = 0;
        const token = this._hoverCard.show(agent, item);
        this._onLoadSessionResources(agent.paneKey)
          .then(resources => this._hoverCard?.setResources(token, resources))
          .catch(() => this._hoverCard?.setResources(token, null, true));
        if (!agent.model || !agent.effort) {
          this._onLoadSessionDetails(agent)
            .then(details => this._hoverCard?.setIdentity(token, agent, details))
            .catch(() => {});
        }
        return GLib.SOURCE_REMOVE;
      },
    );
  }

  _cancelHover() {
    if (this._hoverTimeoutId) {
      GLib.source_remove(this._hoverTimeoutId);
      this._hoverTimeoutId = 0;
    }
    this._hoverCard?.hide();
  }

  async _openOrca() {
    try {
      await this._onOpenOrca();
    } catch (error) {
      Main.notifyError(
        'No se pudo abrir Orca IDE',
        error.message ?? String(error),
      );
    }
  }

  async _openAgent(agent) {
    try {
      await this._onOpenAgent(agent);
    } catch (error) {
      Main.notifyError(
        'No se pudo abrir la sesión',
        error.message ?? String(error),
      );
    }
  }

  async _createAgent(workspace, button) {
    button.reactive = false;
    try {
      await this._onCreateAgent(workspace);
    } catch (error) {
      button.reactive = true;
      Main.notifyError(
        'No se pudo crear la sesión',
        error.message ?? String(error),
      );
    }
  }

  _requestClose(agent, button) {
    if (!requiresCloseConfirmation(agent.status)) {
      this._closeAgent(agent, button);
      return;
    }

    this.menu.close();
    const dialog = new ModalDialog.ModalDialog();
    dialog.contentLayout.add_child(new Dialog.MessageDialogContent({
      title: `¿Cerrar “${agent.name}”?`,
      description: 'La sesión requiere atención y el agente será detenido.',
    }));
    dialog.addButton({
      label: 'Cancelar',
      action: () => dialog.close(),
      key: Clutter.KEY_Escape,
    });
    dialog.addButton({
      label: 'Cerrar sesión',
      action: () => {
        dialog.close();
        this._closeAgent(agent, button);
      },
    });
    dialog.open();
  }

  async _closeAgent(agent, button) {
    button.reactive = false;
    try {
      await this._onCloseAgent(agent);
    } catch (error) {
      button.reactive = true;
      Main.notifyError(
        'No se pudo cerrar la sesión',
        error.message ?? String(error),
      );
    }
  }
});
