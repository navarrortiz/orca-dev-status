import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {
  BOILERPLATE_STATUS_AREA_NAME,
  LOCATION_BY_INDEX,
  SETTINGS_KEYS,
} from '../shared/constants.js';
import { BoilerplateIndicator } from '../ui/indicator.js';

export default class ExtensionController {
  constructor(extension) {
    this._extension = extension;
    this._indicator = null;
    this._settings = null;
    this._settingsSignals = [];
  }

  enable() {
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
    ];
    this._placeIndicator();
  }

  _placeIndicator() {
    this._indicator?.destroy();
    this._indicator = new BoilerplateIndicator(this._extension);
    Main.panel.addToStatusArea(
      BOILERPLATE_STATUS_AREA_NAME,
      this._indicator,
      this._settings.get_int(SETTINGS_KEYS.statusBarIndex),
      LOCATION_BY_INDEX[this._settings.get_int(SETTINGS_KEYS.statusBarLocation)],
    );
  }

  disable() {
    for (const signalId of this._settingsSignals)
      this._settings.disconnect(signalId);

    this._settingsSignals = [];
    this._indicator?.destroy();
    this._indicator = null;
    this._settings = null;
  }
}
