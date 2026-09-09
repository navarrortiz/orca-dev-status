import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import { SETTINGS_KEYS } from '../../shared/constants.js';

export function createPollingGroup(settings) {
  const group = new Adw.PreferencesGroup({ title: 'Actualización' });
  const row = new Adw.SpinRow({
    title: 'Intervalo de consulta',
    subtitle: 'Segundos entre consultas al CLI de Orca',
    adjustment: new Gtk.Adjustment({
      lower: 2,
      upper: 60,
      value: 5,
      step_increment: 1,
      page_increment: 5,
    }),
  });
  settings.bind(
    SETTINGS_KEYS.pollInterval,
    row,
    'value',
    Gio.SettingsBindFlags.DEFAULT,
  );
  group.add(row);
  return group;
}
