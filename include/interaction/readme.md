# 🧠 Mindy – The Cacti Interaction Middleware
> **"MidWinter Not Dead Yet"** – Decoupling Cacti Core from Modern UI Themes.

Mindy is a high-performance interaction layer designed to bridge the gap between the **Cacti Core** (Legacy HTML/AJAX) and modern **UI Themes** (like MidWinter). It acts as a centralized logistics hub that captures, transforms, and delivers DOM elements and state information.

---

## 🏗 Core Pillars
1. **Mutation Observer**: Monitors the DOM for AJAX-injected content from Cacti.
2. **Logistics Mapping**: Routes Cacti selectors to specific **Theme Anchors** (`data-mindy-anchor`).
3. **Parcel Service**: A secure mailbox system for isolated plugins (e.g., sidebar filters).
4. **Context API**: Global state management for tracking the current Cacti rubric, category, and action.

---

## 📡 Context API
The Context API allows Mindy to keep track of where the user is within Cacti. This is vital for breadcrumbs, sidebar visibility, and context-aware plugin behavior.

### Setting Context
Mindy captures the context automatically via AJAX anchor delegation or manual calls:
```javascript
Mindy.setContext({
    rubric: 'Management',
    category: 'Devices',
    action: 'Edit',
    helper: 'host.php'
});
```

### Subscribing to Context Changes
Plugins or Theme components can react to navigation changes:
```javascript
Mindy.subscribe('context:changed', (ctx) => {
    console.log(`User moved to: ${ctx.rubric} > ${ctx.category}`);
    // Update breadcrumbs or fetch additional data based on ctx.helper
});
```

---

## 🛠 Developer Guide: Building Mindy Plugins

Mindy plugins are isolated components that receive data from Cacti via the **Parcel Service**.

### 1. Registration & Parcel Subscription
Register your plugin with a unique ID and listen for incoming data.

```javascript
Mindy.register('nav-filter', {
    init: function($container) {
        Mindy.subscribe('plugin:parcel:ready', (parcel) => {
            if (parcel.id === 'nav-filter') {
                // Officially collect the content (empties the mailbox)
                const $content = Mindy.ui.layout.collect(parcel.id);
                this.render($content);
            }
        });
    },
    render: function($content) {
        $('.plugin-content').html($content);
    }
});
```

### 2. Mapping to Plugins
In your theme setup, define which Cacti element should be "parceled" to your plugin:
```javascript
Mindy.ui.layout.map = {
    'form.cactiFilter': 'nav-filter' 
};
```

---

## ⚓ Theme Integration (Anchors)
Themes define "Landing Zones" using the `data-mindy-anchor` attribute. Use the prefix `anchor-` for consistency.

### Example Grid Setup
```html
<div id="mdw-ActionBar" data-mindy-anchor="anchor-ActionBarMiddle">
    <!-- Mindy delivers Cacti buttons here -->
</div>
```

### The Relocation Logic
Mindy's `relocate` function ensures **Idempotency**. It uses internal markers (`data-mindy-source`) to prevent element stacking during AJAX reloads.

---

## 🛡 Logistics & Safety Rules
* **isSyncing Guard**: Mindy automatically disconnects the observer during relocation to prevent infinite loops.
* **Destruction List**: Define legacy elements in `Mindy.state.destructionList` to purge them after a successful sync.
* **Popover Protection**: Mindy distinguishes between main page updates and Popover (Modal) updates to preserve the UI state.

---

## 🚀 Quick Start for Themes
1. **Initialize** your grid structure in the DOM.
2. **Register** your Transformers for surgical HTML changes.
3. **Define** your `Mindy.ui.layout.map`.
4. **Call** `Mindy.init()` to start the engine.

## 📢 Event Reference (Pub/Sub)

Mindy uses a centralized Event Bus based on `EventTarget`. Use `Mindy.subscribe(event, callback)` to listen and `Mindy.publish(event, data)` to trigger.


| Event | Direction | Description | Data Payload |
| :--- | :--- | :--- | :--- |
| `mindy:ready` | Output | Fired when Mindy has finished its initial sync. | `{ timestamp: Date.now() }` |
| `context:changed` | Output | Fired whenever the Cacti rubric or action is updated. | `{ rubric, category, action, helper }` |
| `plugin:parcel:ready` | Output | Notifies a plugin that new content has arrived in its mailbox. | `{ id: "plugin-id", mailboxId: "html-id" }` |
| `ui:content:ready` | Output | Fired after `applyMap` finished all relocations and transformers. | `{ timestamp: Date.now() }` |
| `ux:colorMode:changed` | Bi-Di | Syncs theme appearance between Mindy and the Theme. | `{ mode: "light" \| "dark" }` |
| `plugin:state:changed`| Input | Should be fired by plugins to report their content status. | `{ id, hasContent: bool, helper }` |
| `navigation:nodeSelected`| Output | Fired when a user selects a node in the Cacti Tree. | `{ id, text, type }` |

---

## 🛠 Troubleshooting Tip: The "Ghost" Prevention
If you notice elements stacking up despite relocation, check the **Logistics Rule #1**: Mindy automatically ignores elements that are already children of a target anchor during the source lookup. This prevents Mindy from "stealing" from itself.
