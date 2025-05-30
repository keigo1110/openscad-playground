// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React, { useContext } from 'react';
import { SingleLayoutComponentId } from '../state/app-state.ts'
import { TabMenu } from 'primereact/tabmenu';
import { ToggleButton } from 'primereact/togglebutton';
import { ModelContext } from './contexts.ts';
import { useTranslation } from 'react-i18next';

export default function PanelSwitcher() {
  const model = useContext(ModelContext);
  const { t } = useTranslation();
  if (!model) throw new Error('No model');

  const state = model.state;

  const singleTargets: {id: SingleLayoutComponentId, icon: string, label: string}[] = [
    { id: 'aigenerator', icon: 'pi pi-sparkles', label: t('panel.aiGenerate') },
    { id: 'editor', icon: 'pi pi-pencil', label: t('panel.edit') },
    { id: 'viewer', icon: 'pi pi-box', label: t('panel.view') },
  ];
  if ((state.parameterSet?.parameters?.length ?? 0) > 0) {
    singleTargets.push({ id: 'customizer', icon: 'pi pi-sliders-h', label: t('panel.customize') });
  }
  const multiTargets = singleTargets;

  return (
    <div className="">
      <div className='flex flex-row' style={{
        margin: '5px',
        position: 'relative',
      }}>

        {state.view.layout.mode === 'multi'
          ?   <div className='flex flex-row gap-1' style={{
            justifyContent: 'center',
            flex: 1,
            margin: '5px'
          }}>
                {multiTargets.map(({icon, label, id}) => 
                  <ToggleButton
                    key={id}
                    checked={(state.view.layout as any)[id]}
                    onLabel={label}
                    offLabel={label}
                    onIcon={icon}
                    offIcon={icon}
                    onChange={e => model.changeMultiVisibility(id, e.value)}
                    />
                  )}
              </div>
          :   <>
                <TabMenu
                  activeIndex={singleTargets.map(t => t.id).indexOf(state.view.layout.focus)}
                  style={{
                    flex: 1,
                  }}
                  model={singleTargets.map(({icon, label, id}) => 
                  ({icon, label, command: () => model.changeSingleVisibility(id)}))} />
              </>
        }
      </div>
    </div>
  );
}
