import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { buildPreferencesPage } from './src/prefs/page.js';

export default class BoilerplateExtensionPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    window.add(buildPreferencesPage(this.getSettings()));
  }
}
