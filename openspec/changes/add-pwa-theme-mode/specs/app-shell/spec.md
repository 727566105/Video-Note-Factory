## ADDED Requirements

### Requirement: Progressive Web App Metadata
The system SHALL expose installable PWA metadata for VideoNote through a web manifest.

#### Scenario: Browser reads manifest
- **WHEN** the frontend loads in a browser
- **THEN** the document includes a manifest link with VideoNote name, icons, theme color, display mode, and start URL.

### Requirement: Safe App Shell Caching
The system SHALL register a service worker that caches static app shell assets while avoiding stale API responses.

#### Scenario: API request passes through
- **WHEN** the service worker observes a request under `/api/`
- **THEN** it does not serve that request from the static cache.

### Requirement: Theme Mode Selection
The system SHALL support light, dark, and system theme modes.

#### Scenario: User selects dark mode
- **WHEN** the user selects dark mode
- **THEN** the app applies the dark theme immediately and persists the selection.

#### Scenario: User selects system mode
- **WHEN** the user selects system mode
- **THEN** the app follows `prefers-color-scheme` and updates when the system preference changes.

### Requirement: Comfortable Dark Palette
The system SHALL use deep gray dark surfaces instead of pure black for primary application backgrounds.

#### Scenario: Dark mode active
- **WHEN** dark mode is active
- **THEN** base surfaces use comfortable dark grays centered around `#2D2D2D`, with readable text and visible borders.
