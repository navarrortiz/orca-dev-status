import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import { SETTINGS_KEYS } from '../../shared/constants.js';

export function createLocationGroup(settings) {
  const group = new Adw.PreferencesGroup({ title: 'Posición' });
  const indexRow = new Adw.SpinRow({
    title: 'Índice en la barra',
    adjustment: new Gtk.Adjustment({
      lower: -1,
      upper: 5,
      value: 0,
      step_increment: 1,
      page_increment: 1,
    }),
  });
  settings.bind(
    SETTINGS_KEYS.statusBarIndex,
    indexRow,
    'value',
    Gio.SettingsBindFlags.DEFAULT,
  );
  group.add(indexRow);

  const row = new Adw.ActionRow({ title: 'Zona de la barra' });
  row.add_suffix(createLocationSelector(settings));
  group.add(row);
  return group;
}

function createLocationSelector(settings) {
  const box = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    valign: Gtk.Align.CENTER,
  });
  box.add_css_class('linked');

  const buttons = ['Izquierda', 'Centro', 'Derecha'].map((label, index) => {
    const button = new Gtk.ToggleButton({
      label,
      group: index === 0 ? null : box.get_first_child(),
    });
    button.connect('toggled', () => {
      if (button.active)
        settings.set_int(SETTINGS_KEYS.statusBarLocation, index);
    });
    box.append(button);
    return button;
  });
  buttons[settings.get_int(SETTINGS_KEYS.statusBarLocation)].active = true;
  return box;
}
