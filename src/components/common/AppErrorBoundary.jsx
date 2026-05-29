import React from 'react';
import { DEFAULT_LANGUAGE, getTranslation } from '../../i18n/translationCatalog.js';
import { brandConfig } from '../../config/brandConfig.js';

function safeTranslate(key, language, fallback) {
  try {
    return getTranslation(key, language || DEFAULT_LANGUAGE) || fallback;
  } catch {
    return fallback;
  }
}

function createErrorReference() {
  return new Date().toISOString();
}

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      errorReference: null,
    };
  }

  static getDerivedStateFromError() {
    return {
      hasError: true,
      errorReference: createErrorReference(),
    };
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      errorReference: null,
    });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const language = this.props.language || DEFAULT_LANGUAGE;

    return (
      <main className="page-shell" role="alert" aria-live="assertive" style={{ padding: 24 }}>
        <section
          className="empty-state"
          style={{
            background: brandConfig.colors.white,
            border: `1px solid ${brandConfig.colors.red}`,
            borderRadius: brandConfig.ui.borderRadius,
            boxShadow: brandConfig.ui.cardShadow,
            maxWidth: 720,
            padding: 24,
          }}
        >
          <p className="eyebrow">{safeTranslate('unexpected_error', language, 'Unexpected error')}</p>
          <h1>{safeTranslate('something_went_wrong', language, 'Something went wrong')}</h1>
          <p>
            {safeTranslate(
              'contact_admin_if_persists',
              language,
              'Contact an administrator if the problem continues.',
            )}
          </p>
          <p>
            {safeTranslate('error_reference', language, 'Error reference')}: {this.state.errorReference}
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            style={{
              background: brandConfig.colors.gold,
              border: 0,
              borderRadius: 7,
              color: brandConfig.colors.black,
              cursor: 'pointer',
              fontWeight: 700,
              minHeight: 40,
              padding: '8px 14px',
            }}
          >
            {safeTranslate('try_again', language, 'Try again')}
          </button>
        </section>
      </main>
    );
  }
}
