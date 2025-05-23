// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { CSSProperties, useContext, useRef } from 'react';
import { Button } from 'primereact/button';
import { MenuItem } from 'primereact/menuitem';
import { Menu } from 'primereact/menu';
import { ModelContext } from './contexts.ts';
import { isInStandaloneMode } from '../utils.ts';
import { confirmDialog } from 'primereact/confirmdialog';
import { useTranslation } from 'react-i18next';

export default function SettingsMenu({className, style}: {className?: string, style?: CSSProperties}) {
  const model = useContext(ModelContext);
  const { t } = useTranslation();
  if (!model) throw new Error('No model');
  const state = model.state;

  const settingsMenu = useRef<Menu>(null);

  return (
    <>
      <Menu model={[
        {
          label: state.view.layout.mode === 'multi'
            ? t('settings.layout.switchToSingle')
            : t('settings.layout.switchToMulti'),
          icon: 'pi pi-table',
          command: () => model.changeLayout(state.view.layout.mode === 'multi' ? 'single' : 'multi'),
        },
        {
          separator: true
        },  
        {
          label: state.view.showAxes ? t('settings.axes.hide') : t('settings.axes.show'),
          icon: 'pi pi-asterisk',
          command: () => model.mutate(s => s.view.showAxes = !s.view.showAxes)
        },
        {
          label: state.view.lineNumbers ? t('settings.lineNumbers.hide') : t('settings.lineNumbers.show'),
          icon: 'pi pi-list',
          command: () => model.mutate(s => s.view.lineNumbers = !s.view.lineNumbers)
        },
        ...(isInStandaloneMode() ? [
          {
            separator: true
          },  
          {
            label: t('settings.clearStorage.label'),
            icon: 'pi pi-trash',
            command: () => {
              confirmDialog({
                message: t('settings.clearStorage.message'),
                header: t('settings.clearStorage.title'),
                icon: 'pi pi-exclamation-triangle',
                accept: () => {
                  localStorage.clear();
                  location.reload();
                },
                acceptLabel: t('settings.clearStorage.confirm'),
                rejectLabel: t('settings.clearStorage.cancel')
              });
            },
          },
        ] : []),
      ] as MenuItem[]} popup ref={settingsMenu} />
    
      <Button title={t('settings.title')}
          style={style}
          className={className}
          rounded
          text
          icon="pi pi-cog"
          onClick={(e) => settingsMenu.current && settingsMenu.current.toggle(e)} />
    </>
  );
}