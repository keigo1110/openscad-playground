import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from 'primereact/button';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const getCurrentLanguageInfo = () => {
    return i18n.language === 'ja' 
      ? { currentLang: 'ja', nextLang: 'en', label: '日本語', nextLabel: 'English' }
      : { currentLang: 'en', nextLang: 'ja', label: 'English', nextLabel: '日本語' };
  };

  const toggleLanguage = () => {
    const { nextLang } = getCurrentLanguageInfo();
    i18n.changeLanguage(nextLang);
  };

  const { label, nextLabel } = getCurrentLanguageInfo();

  return (
    <Button
      label={label}
      icon="pi pi-globe"
      onClick={toggleLanguage}
      className="p-button-text"
      tooltip={`Switch to ${nextLabel}`}
      style={{ 
        fontSize: '12px',
        padding: '4px 8px',
        height: 'auto'
      }}
    />
  );
} 