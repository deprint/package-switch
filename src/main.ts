/*
 * decaffeinate suggestions:
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import { CompositeDisposable } from "atom"
import fs from "fs"
import path from "path"
import { InitFileView } from "./init-file-view"
import { InitFile, InitFileCSON } from "./init-file"
import { BundleView } from "./bundle-view"
import { BundlesView } from "./bundles-view"
import { NameView } from "./name-view"
import { Bundles } from "./bundles"

let bundles: Bundles
let bundleview: BundleView
let bundlesview: BundlesView
let nameview: NameView
let initfileview: InitFileView

let subscriptions: CompositeDisposable

export function activate() {
  loadProjectConfigs()
  subscriptions = new CompositeDisposable()

  subscriptions.add(
    atom.commands.add("atom-workspace", {
      "package-switch:start-packages": () => toggle(),
      "package-switch:stop-packages": () => toggle(true),
      "package-switch:create": () => create(),
      "package-switch:edit": () => edit(),
      "package-switch:remove": () => remove(),
      "package-switch:open-global": () => {
        atom.workspace.open(path.join(path.dirname(atom.config.getUserConfigPath()), "package-switch.bundles"))
      },
    }),

    atom.commands.add(
      '.tree-view .file .name[data-name$="\\.package-switch\\.json"]',
      "package-switch:open-local",
      ({ target }) => atom.workspace.open(target.dataset.path, { noopener: true })
    ),
    atom.config.onDidChange("package-switch.SaveRestore", ({ newValue }) => {
      if (newValue) {
        saveStates()
      }
    }),
    atom.workspace.addOpener(function (uritoopen, { noopener }) {
      if (noopener == null) {
        if (uritoopen.endsWith(".package-switch.json")) {
          initfileview = new InitFileView({
            uri: uritoopen,
            file: new InitFile(path.dirname(uritoopen), uritoopen),
          })
        }
        // deprecated
        else if (uritoopen.endsWith(".package-switch.cson")) {
          console.error("here")
          initfileview = new InitFileView({
            uri: uritoopen,
            file: new InitFileCSON(path.dirname(uritoopen), uritoopen),
          })
        }
      }
    })
  )
}

export function deactivate() {
  if (atom.config.get("package-switch.SaveRestore")) {
    if (atom.config.get("package-switch.InvertSaveData")) {
      const lp = atom.config.get("package-switch.DisableLanguagePackages")
      const saveData = atom.config.get("package-switch.SaveData")
      const disabledPackages = []
      for (const p of atom.packages.getAvailablePackageNames()) {
        if (p === "package-switch") {
          continue
        }
        if (saveData.includes(p)) {
          continue
        }
        if (lp && p.startsWith("language-")) {
          continue
        }
        disabledPackages.push(p)
      }
      atom.config.set("core.disabledPackages", disabledPackages)
    } else {
      atom.config.set("core.disabledPackages", atom.config.get("package-switch.SaveData"))
    }
    atom.config.save()
  }
  subscriptions.dispose()
  if (bundles) {
    bundles.destroy()
  }
  if (nameview) {
    nameview.destroy()
  }
  if (initfileview) {
    initfileview.destroy()
  }
}

export const config = {
  SaveRestore: {
    title: "Save and restore packages",
    description: "Restore package states when deactivating this package (e.g. when closing Atom)",
    type: "boolean",
    default: false,
  },
  SaveData: {
    title: "Package States",
    description: "Array of packages to disable when deactivating this package",
    type: "array",
    default: [],
  },
  DeferInitialization: {
    title: "Activation Timeout",
    description: "Number of milliseconds to defer execution of local bundles",
    type: "integer",
    default: 100,
  },
  InvertSaveData: {
    title: "Invert Package States",
    description:
      'Disable ALL packages EXCEPT those in "Package States". This includes core packages like tabs, tree-view and settings-view!!!',
    type: "boolean",
    default: false,
  },
  DisableLanguagePackages: {
    title: "Do not disable Language Packages",
    description: 'Do not disable language packages. Only if "Invert Package States" is checked',
    type: "boolean",
    default: false,
  },
}

function createBundleView() {
  if (!bundleview) {
    bundleview = new BundleView()
  }
}

function createBundlesView() {
  if (!bundlesview) {
    bundlesview = new BundlesView()
  }
}

function createNameView() {
  if (!nameview) {
    nameview = new NameView()
  }
}

function createBundlesInstance() {
  if (!bundles) {
    bundles = new Bundles()
  }
}

function loadProjectConfigs() {
  const p = atom.project.getPaths()
  if (p.length === 1) {
    const f = path.join(p[0], ".package-switch.json")
    fs.stat(f, function (fileError, stats) {
      if (fileError && !stats) {
        atom.packages.activatePackage("tree-view")
        atom.packages.activatePackage("tabs")
        atom.packages.activatePackage("settings-view")
        atom.packages.activatePackage("command-palette")
      }
      setTimeout(
        () => new InitFile(path.basename(p[0]), f).execute(false),
        atom.config.get("package-switch.DeferInitialization")
      )
    })

    // deprecated
    const fcson = path.join(p[0], ".package-switch.cson")
    if (fs.existsSync(fcson)) {
      fs.stat(fcson, function (fileError, stats) {
        if (fileError && !stats) {
          atom.packages.activatePackage("tree-view")
          atom.packages.activatePackage("tabs")
          atom.packages.activatePackage("settings-view")
          atom.packages.activatePackage("command-palette")
        }
        setTimeout(
          () => new InitFileCSON(path.basename(p[0]), fcson).execute(false),
          atom.config.get("package-switch.DeferInitialization")
        )
      })
    }
  } else {
    atom.packages.activatePackage("tree-view")
    atom.packages.activatePackage("tabs")
    atom.packages.activatePackage("settings-view")
    atom.packages.activatePackage("command-palette")
  }
}

function toggleCallback(opposite, bundle) {
  bundles.getBundle(bundle.name)?.execute(opposite)
}

function removeCallback(bundle) {
  bundles.removeBundle(bundle.name)
}

function saveStates() {
  atom.config.set(
    "package-switch.SaveData",
    atom.config.get("core.disabledPackages").filter((item, index, array) => array.indexOf(item) === index)
  )
}

function toggle(opposite = false) {
  createBundlesInstance()
  createBundlesView()
  bundlesview.show(
    bundles.getBundles(),
    (bundle) => {
      toggleCallback(opposite, bundle)
    },
    opposite
  )
}

function remove() {
  createBundlesInstance()
  createBundlesView()
  bundlesview.show(bundles.getBundles(false), (bundle) => removeCallback(bundle))
}

function createCallback(oldname, items) {
  createNameView()
  nameview.show(bundles, oldname, items, {
    confirmCallback: (oldname, name, packages) => {
      nameCallback(oldname, name, packages)
    },
    backCallback: (oldname, _items) =>
      create({
        name: oldname,
        packages: _items,
      }),
  })
}

function nameCallback(oldname, name, packages) {
  if (oldname != null) {
    bundles.replaceBundle(oldname, name, packages)
  } else {
    bundles.addBundle(name, packages)
  }
}

function create(bundle = null) {
  createBundlesInstance()
  createBundleView()
  bundleview.show(bundle, (oldname, items) => createCallback(oldname, items))
}

function edit() {
  createBundlesInstance()
  createBundlesView()
  bundlesview.show(bundles.getBundles(false), (bundle) => create(bundle))
}
