import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import OrcaClient from '../orca/client.js';
import { unavailableStatus } from '../orca/status-model.js';
import {
  ORCA_STATUS_AREA_NAME,
  LOCATION_BY_INDEX,
  SETTINGS_KEYS,
} from '../shared/constants.js';
import { OrcaIndicator } from '../ui/indicator.js';

export default class ExtensionController {
  constructor(extension) {
    this._extension = extension;
    this._indicator = null;
    this._settings = null;
    this._settingsSignals = [];
    this._client = null;
    this._pollId = 0;
    this._polling = false;
    this._refreshPending = false;
    this._enabled = false;
    this._snapshot = unavailableStatus();
    this._updatedAt = null;
  }

  enable() {
    this._enabled = true;
    this._client = new OrcaClient();
    this._settings = this._extension.getSettings();
    this._settingsSignals = [
      this._settings.connect(
        `changed::${SETTINGS_KEYS.statusBarIndex}`,
        () => this._placeIndicator(),
      ),
      this._settings.connect(
        `changed::${SETTINGS_KEYS.statusBarLocation}`,
        () => this._placeIndicator(),
      ),
      this._settings.connect(
        `changed::${SETTINGS_KEYS.pollInterval}`,
        () => this._restartPolling(),
      ),
    ];
    this._placeIndicator();
    this._restartPolling();
  }

  _restartPolling() {
    if (this._pollId)
      GLib.source_remove(this._pollId);

    this._poll();
    this._pollId = GLib.timeout_add_seconds(
      GLib.PRIORITY_DEFAULT,
      this._settings.get_int(SETTINGS_KEYS.pollInterval),
      () => {
        this._poll();
        return GLib.SOURCE_CONTINUE;
      },
    );
  }

  _placeIndicator() {
    this._indicator?.destroy();
    this._indicator = new OrcaIndicator(
      this._extension,
      () => this._poll(true),
      () => this._client.open(),
      agent => this._switchAgent(agent),
      agent => this._closeAgent(agent),
    );
    Main.panel.addToStatusArea(
      ORCA_STATUS_AREA_NAME,
      this._indicator,
      this._settings.get_int(SETTINGS_KEYS.statusBarIndex),
      LOCATION_BY_INDEX[this._settings.get_int(SETTINGS_KEYS.statusBarLocation)],
    );
    this._indicator.update(this._snapshot, this._updatedAt);
  }

  async _poll(force = false) {
    if (!this._enabled)
      return;
    if (this._polling) {
      this._refreshPending ||= force;
      return;
    }

    this._polling = true;
    try {
      const snapshot = await this._client.fetchStatus();
      if (this._enabled)
        this._snapshot = snapshot;
    } catch (error) {
      if (this._enabled) {
        console.warn(`Orca Dev Status: ${error.message ?? error}`);
        this._snapshot = unavailableStatus();
      }
    } finally {
      this._polling = false;
      if (this._enabled) {
        this._updatedAt = GLib.DateTime.new_now_local().format('%H:%M:%S');
        this._indicator?.update(this._snapshot, this._updatedAt);
        if (this._refreshPending) {
          this._refreshPending = false;
          this._poll();
        }
      }
    }
  }

  async _closeAgent(agent) {
    await this._client.closeAgent(agent.worktreeId, agent.paneKey);
    await this._poll(true);
  }

  async _switchAgent(agent) {
    await this._client.switchAgent(agent.worktreeId, agent.paneKey);
  }

  disable() {
    this._enabled = false;
    if (this._pollId) {
      GLib.source_remove(this._pollId);
      this._pollId = 0;
    }
    this._client?.cancel();
    this._refreshPending = false;

    for (const signalId of this._settingsSignals)
      this._settings.disconnect(signalId);

    this._settingsSignals = [];
    this._indicator?.destroy();
    this._indicator = null;
    this._settings = null;
    this._client = null;
    this._snapshot = unavailableStatus();
    this._updatedAt = null;
  }
}
