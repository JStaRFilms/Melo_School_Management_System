# Feature Blueprint: Report Card Bundle Workbench Refactor

Modernize the `/assessments/setup/report-card-bundles` interface by implementing the **Independent Scroll Workbench** (Split Bucket) architecture. This refactor eliminates UI fragmentation (card-heavy design), optimizes visual density, and removes redundant instructional text ("slop") while aligning with established admin UI standards.

## 1. Goal

- Implement a high-density, professional administrative workbench.
- Replace card-heavy layouts with cohesive `AdminSurface` containers.
- Optimize for power users by removing redundant explanatory text and streamlining workflows.
- Ensure independent scrolling for the item list (sidebar) and the editor (main content).

## 2. Components & Architecture


### Layout: Independent Scroll Workbench

- **Outer Container**: `h-screen overflow-hidden` (on desktop).
- **Header**: `AdminHeader` with breadcrumbs and primary tab switcher.
- **Split Bucket**:
    - **Aside (Sidebar)**: `BundleList` or `TemplateList` (350px - 400px).
    - **Main (Content Area)**: `BundleEditor` or `ScaleTemplateEditor` + Preview/Assignment.

### Data Flow

- **Tabs**: "Bundles" (default) and "Reusable Scales".
- **Selection State**: `selectedBundleId` and `selectedScaleId` persist in the parent screen.
- **Draft State**: Local draft management in `ReportCardBundlesScreen` with a unified `EditorActionBar`.

## 3. Visual Refinements

- **Typography**: Remove verbose introductory paragraphs and small "instructional" notes.
- **Spacing**: Use tighter, consistent spacing (`p-4`, `p-6`).
- **Cards**: Replace nested `div.rounded-2xl.border` with streamlined rows and subtle separators.
- **Animations**: Use `animate-in fade-in slide-in-from-right-4` for editor transitions.

## 4. Implementation Plan


### Step 1: Update `ReportCardBundlesScreen.tsx`

- Implement the Split Bucket layout (`main` + `aside`).
- Inject `custom-scrollbar` styles.
- Streamline the header and tab navigation.

### Step 2: Refactor `BundleEditor.tsx`

- Remove slop (instructional text).
- Use `AdminSurface` or simpler containers.
- Optimize field rows for density.

### Step 3: Refactor `ScaleTemplateEditor.tsx`

- Apply similar density and slop-removal patterns.

### Step 4: Refactor `BundleList.tsx` & `TemplateList.tsx`

- Ensure they fit the Sidebar Bucket pattern (full height, independent scroll).

### Step 5: Final Polish

- Ensure the `EditorActionBar` is clean and non-intrusive.
- Verify mobile responsiveness (stacked layout).
