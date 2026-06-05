## ADDED Requirements

### Requirement: Share Poster Entry
The system SHALL provide a share entry in the note detail page for generated notes.

#### Scenario: Open share poster dialog
- **GIVEN** a user is viewing a note detail page with generated note content
- **WHEN** the user clicks the share entry
- **THEN** the system displays a share poster dialog
- **AND** the dialog shows a generated poster preview
- **AND** the dialog provides style selection and sharing actions

#### Scenario: Share entry disabled without content
- **GIVEN** a note has no generated note content
- **WHEN** the note detail page renders
- **THEN** the share entry is disabled or hidden
- **AND** the user cannot generate an empty poster

### Requirement: Share Poster Content
The system SHALL generate a poster that includes video and note context.

#### Scenario: Poster includes required information
- **GIVEN** a note has a title, author, platform, cover image, note content, and URL
- **WHEN** the share poster is generated
- **THEN** the poster includes the video cover image
- **AND** the poster includes the note title
- **AND** the poster includes author and platform information when available
- **AND** the poster includes a readable excerpt of the note content
- **AND** the poster includes the share time
- **AND** the poster includes a QR code for the share link

#### Scenario: Cover image fallback
- **GIVEN** the video cover image cannot be loaded
- **WHEN** the share poster is generated
- **THEN** the poster uses a style-specific fallback visual
- **AND** image generation still succeeds

### Requirement: Poster Style Selection
The system SHALL support a configurable poster style library with multiple platform-inspired and editorial visual treatments.

#### Scenario: Style library is available
- **GIVEN** the share poster dialog is open
- **WHEN** the style selector renders
- **THEN** the system displays multiple poster styles
- **AND** the initial style library includes B 站、小红书、YouTube、X、微信公众号、专业简约
- **AND** each style shows a name, visual preview, color mood, and short usage description

#### Scenario: Bilibili style poster
- **GIVEN** the user selects the B 站 style
- **WHEN** the poster preview renders
- **THEN** the poster uses B 站-inspired blue/pink accents
- **AND** the poster includes related icon or badge elements
- **AND** the poster presents a modern video-community visual style

#### Scenario: Xiaohongshu style poster
- **GIVEN** the user selects the 小红书 style
- **WHEN** the poster preview renders
- **THEN** the poster uses warm red, cream, and editorial card styling
- **AND** the poster includes lifestyle/social-note visual elements
- **AND** the poster appears suitable for social media sharing

#### Scenario: YouTube style poster
- **GIVEN** the user selects the YouTube style
- **WHEN** the poster preview renders
- **THEN** the poster uses high-contrast red, black, and white accents
- **AND** the poster emphasizes video thumbnail hierarchy and creator metadata
- **AND** the poster feels like a polished video recap card

#### Scenario: X style poster
- **GIVEN** the user selects the X style
- **WHEN** the poster preview renders
- **THEN** the poster uses sharp monochrome or dark-mode styling
- **AND** the poster prioritizes concise quote-like note excerpts
- **AND** the poster includes minimal social-feed visual cues

#### Scenario: WeChat official account style poster
- **GIVEN** the user selects the 微信公众号 style
- **WHEN** the poster preview renders
- **THEN** the poster uses editorial green, ink, or magazine-inspired accents
- **AND** the poster emphasizes article-like typography and reading comfort
- **AND** the poster includes a QR-code-forward layout suitable for WeChat sharing

#### Scenario: Professional style poster
- **GIVEN** the user selects the professional style
- **WHEN** the poster preview renders
- **THEN** the poster uses restrained neutral colors with one accent color
- **AND** the poster prioritizes readability and professional presentation

### Requirement: Poster Actions
The system SHALL provide actions to save the poster image, invoke system share, and copy the share link.

#### Scenario: Save poster image
- **GIVEN** a poster preview has been generated
- **WHEN** the user clicks save poster
- **THEN** the system downloads a PNG image
- **AND** the filename includes the note title and current date when possible

#### Scenario: System share
- **GIVEN** a poster preview has been generated
- **AND** the browser supports system sharing
- **WHEN** the user clicks system share
- **THEN** the system opens the native share sheet with the poster image and share link when supported

#### Scenario: System share fallback
- **GIVEN** the browser does not support system sharing for files
- **WHEN** the user clicks system share
- **THEN** the system provides a clear fallback
- **AND** the user can still save the image or copy the link

#### Scenario: Copy share link
- **GIVEN** a note detail page has a shareable URL
- **WHEN** the user clicks copy link
- **THEN** the system copies the share URL to the clipboard
- **AND** shows a success or failure message

### Requirement: Poster Generation Quality
The system SHALL generate a nonblank high-resolution poster suitable for social sharing.

#### Scenario: Poster image quality
- **GIVEN** the poster preview is generated
- **WHEN** the user saves the poster
- **THEN** the saved image is at least 1080px wide
- **AND** text is legible
- **AND** important content is not clipped or overlapped

#### Scenario: Long note content handling
- **GIVEN** the note content is longer than the poster can comfortably display
- **WHEN** the poster is generated
- **THEN** the poster displays a concise excerpt
- **AND** the QR code/link directs users to the full note
