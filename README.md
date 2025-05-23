# OpenSCAD Playground (Fork)

> This is a fork of the original [OpenSCAD Playground](https://github.com/openscad/openscad-playground) with additional features including **Japanese/English language support** and enhanced AI-powered 3D model generation.

[Open the Original Demo](https://ochafik.com/openscad2)

<a href="https://ochafik.com/openscad2" target="_blank">
<img width="694" alt="image" src="https://github.com/user-attachments/assets/58305f27-7e95-4c56-9cd7-0d766e0a21ae" />
</a>

This is a limited port of [OpenSCAD](https://openscad.org) to WebAssembly, with **AI-powered 3D model generation**, using at its core a headless WASM build of OpenSCAD ([done by @DSchroer](https://github.com/DSchroer/openscad-wasm)), wrapped in a UI made of pretty [PrimeReact](https://github.com/primefaces/primereact) components, a [React Monaco editor](https://github.com/react-monaco-editor/react-monaco-editor) (VS Codesque power!), and an interactive [model-viewer](https://modelviewer.dev/) renderer.

It defaults to the [Manifold backend](https://github.com/openscad/openscad/pull/4533) so it's **super** fast.

## 🌐 Enhanced Features in This Fork

- **🗾 Japanese/English Language Support**: Full bilingual interface with one-click language switching
- **🤖 Enhanced AI Integration**: Improved AI-powered 3D model generation with localized prompts
- **🎨 Improved UX**: Better default panel layout (AI Generate, View, Customize open by default)

## 🤖 AI-Powered 3D Model Generation

**New Feature**: Generate 3D models from natural language descriptions!

- **Natural Language Input**: Just describe what you want to create (e.g., "Create a gear with 20 teeth and 5mm thickness")
- **Multiple AI Providers**: Supports OpenAI GPT-4 and Google Gemini APIs
- **Parametric Models**: Generated code includes customizable parameters with sliders
- **Real-time Preview**: Instant 3D visualization as you adjust parameters
- **STL Export**: Ready for 3D printing
- **🌐 Multilingual**: Available in English and Japanese

### How to Use AI Generation

1. Click the "AI Generate" tab
2. Enter your OpenAI or Google Gemini API key (stored locally, never sent to our servers)
3. Describe your 3D model in natural language (English or Japanese)
4. Click "Generate 3D Model"
5. Customize parameters using sliders in the "Customize" tab
6. Export as STL for 3D printing

Enjoy!

Licenses: see [LICENSE.md](./LICENSE.md).

## Features

- **🤖 AI-powered 3D model generation from natural language**
- **🌐 Japanese/English language support with one-click switching**
- Automatic preview on edit (F5), and full rendering on Ctrl+Enter (or F6). Using a trick to force $preview=true.
- [Customizer](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Customizer) support
- Syntax highlighting
- Ships with many standard SCAD libraries (can browse through them in the UI)
- Autocomplete of imports
- Autocomplete of symbols / function calls (pseudo-parses file and its transitive imports)
- Responsive layout. On small screens editor and viewer are stacked onto each other, while on larger screens they can be side-by-side
- Installable as a PWA (then persists edits in localStorage instead of the hash fragment). On iOS just open the sharing panel and tap "Add to Home Screen". *Should not* require any internet connectivity once cached.

## Roadmap

- [x] Add tests!
- [x] Persist camera state
- [x] Support 2D somehow? (e.g. add option in OpenSCAD to output 2D geometry as non-closed polysets, or to auto-extrude by some height)
- [x] Proper Preview rendering: have OpenSCAD export the preview scene to a rich format (e.g. glTF, with some parts being translucent when prefixed w/ % modifier) and display it using https://modelviewer.dev/ maybe)
- ~~Rebuild w/ (and sync) ochafik@'s filtered kernel (https://github.com/openscad/openscad/pull/4160) to fix(ish) 2D operations~~
- [x] Bundle more examples (ask users to contribute)
- Animation rendering (And other formats than STL)
- [x] Compress URL fragment
- [x] Mobile (iOS) editing support: switch to https://www.npmjs.com/package/react-codemirror ?
- [ ] Replace Makefile w/ something that reads the libs metadata
- [ ] Merge modifiers rendering code to openscad
- Model /home fs in shared state. have two clear paths: /libraries for builtins, and /home for user data. State pointing to /libraries paths needs not store the data except if there's overrides (flagged as modifications in the file picker)
- Drag and drop of files (SCAD, STL, etc) and Zip archives. For assets, auto insert the corresponding import.
- Fuller PWA support w/ link Sharing, File opening / association to *.scad files... 
- Look into accessibility
- Setup [OPENSCADPATH](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Libraries#Setting_OPENSCADPATH) env var w/ Emscripten to ensure examples that include assets / import local files will run fine.
- Detect which bundled libraries are included / used in the sources and only download these rather than wait for all of the zips. Means the file explorer would need to be more lazy or have some prebuilt hierarchy.
- Preparse builtin libraries definitions at compile time, ship the JSON.

## Building

Prerequisites:
*   wget
*   GNU make
*   npm
*   Docker able to run amd64 containers. If running on a different platform (including Silicon Mac), you can add support for amd64 images through QEMU with:

  ```bash
  docker run --privileged --rm tonistiigi/binfmt --install all
  ```

Local dev:

```bash
make public
npm install
npm start
# http://localhost:4000/
```

Local prod (test both the different inlining and serving under a prefix):

```bash
make public
npm install
npm run start:prod
# http://localhost:3000/dist/
```

## Deployment

### Vercel Deployment (Recommended)

1. Fork this repository
2. Connect your GitHub repository to Vercel
3. Vercel will automatically build and deploy using the `vercel-build` script
4. Your AI-powered OpenSCAD playground will be live!

### Manual Deployment

Edit "homepage" in `package.json` to match your deployment root, then:

```bash
make public
npm install
NODE_ENV=production npm run build

# Deploy the built files to your hosting service
# Example for GitHub Pages:
# rm -fR ../your-username.github.io/openscad-playground && cp -R dist ../your-username.github.io/openscad-playground 
# Now commit and push changes, wait for site update and enjoy!
```

## Build your own WASM binary

[Makefile](./Makefile) fetches a prebuilt OpenSCAD web WASM binary, but you can build your own in a couple of minutes:

- **Optional**: use your own openscad fork / branch:

  ```bash
  rm -fR libs/openscad
  ln -s $PWD/../absolute/path/to/your/openscad libs/openscad
  
  # If you had a native build directory, delete it.
  rm -fR libs/openscad/build
  ```

- Build WASM binary (add `WASM_BUILD=Debug` argument if you'd like to debug any cryptic crashes):

  ```bash
  make wasm
  ```

- Then continue the build:

  ```bash
  make public
  npm start
  ```

## Adding OpenSCAD libraries

You'll need to update 3 files (search for BOSL2 for an example):

- [Makefile](./Makefile): to pull the library's code (optionally alias some files for easier imports) and package it as a `.zip` archive

- [src/fs/zip-archives.ts](./src/fs/zip-archives.ts): to use the `.zip` archive in the UI (both for file explorer and automatic imports mounting)

- [LICENSE.md](./LICENSE.md): most libraries require proper disclosure of their usage and of their license. If a license is unique, paste it in full, otherwise, link to one of the standard ones already there.

Send us a PR to the [original project](https://github.com/openscad/openscad-playground), then once it's merged request an update to the hosted https://ochafik.com/openscad2 demo.
