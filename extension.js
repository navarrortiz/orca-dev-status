import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import ExtensionController from './src/extension/controller.js';

export default class BoilerplateExtension extends Extension {
  enable() {
    this._controller = new ExtensionController(this);
    this._controller.enable();
  }

  disable() {
    this._controller?.disable();
    this._controller = null;
  }
}
