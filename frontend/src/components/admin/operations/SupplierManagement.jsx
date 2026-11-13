import React from 'react';
import SupplierHub from './SupplierHub';

export default function SupplierManagement({ onGoBack, user, onNavigate }) {
  return (
    <SupplierHub
      channel="All"
      onGoBack={onGoBack}
      user={user}
      onNavigate={onNavigate}
    />
  );
}
