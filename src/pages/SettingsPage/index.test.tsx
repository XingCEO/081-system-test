import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import SettingsPage from './index';
import { DEFAULT_APP_SETTINGS } from '../../services/settingsService';
import { useAppSettingsStore } from '../../stores/useAppSettingsStore';

describe('SettingsPage', () => {
  beforeEach(() => {
    useAppSettingsStore.setState({
      settings: DEFAULT_APP_SETTINGS,
      hydrated: true,
    });
  });

  it('renders the settings form without entering a render loop', () => {
    render(<SettingsPage />);

    expect(screen.getByRole('heading', { name: '系統設定' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('美味餐廳')).toBeInTheDocument();
    expect(screen.getByDisplayValue('NT$')).toBeInTheDocument();
  });
});
