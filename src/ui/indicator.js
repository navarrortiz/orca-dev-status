import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

export const BoilerplateIndicator = GObject.registerClass(
class BoilerplateIndicator extends PanelMenu.Button {
  _init(extension) {
    super._init(0.5, extension.metadata.name, false);

    this._label = new St.Label({
      text: 'Hello word!',
      style_class: 'gnome-boilerplate-panel-label',
      accessible_name: 'Hello word!',
      y_align: Clutter.ActorAlign.CENTER,
    });
    this.add_child(this._label);
    this.menu.addAction('Settings', () => extension.openPreferences());
  }

  destroy() {
    super.destroy();
  }
});
