/*
  +-------------------------------------------------------------------------+
  | Copyright (C) 2004-2026 The Cacti Group                                 |
  |                                                                         |
  | This program is free software; you can redistribute it and/or           |
  | modify it under the terms of the GNU General Public License             |
  | as published by the Free Software Foundation; either version 2          |
  | of the License, or (at your option) any later version.                  |
  |                                                                         |
  | This program is distributed in the hope that it will be useful,         |
  | but WITHOUT ANY WARRANTY; without even the implied warranty of          |
  | MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the           |
  | GNU General Public License for more details.                            |
  +-------------------------------------------------------------------------+
  | Cacti: The Complete RRDTool-based Graphing Solution                     |
  +-------------------------------------------------------------------------+
  | This code is designed, written, and maintained by the Cacti Group. See  |
  | about.php and/or the AUTHORS file for specific developer information.   |
  +-------------------------------------------------------------------------+
  | http://www.cacti.net/                                                   |
  +-------------------------------------------------------------------------+
*/

/* midwinter session object */
select2Setup = { displayDefaultLabel : true };
const registry = {};

/* midwinter session object */
let mdw = {
	session: {
		theme: {
			boxes:      { animated: 'on' },
			color:      { mode: 'dark', auto: 'off' },
			controls:   { subTitle: 'off', tooltip: 'on' },
			font:       { zoom: 75 },
			mobile:     { autoTableLayout: 'off' },
		},
	},
	obj: { box: {}, ctrl: {} },
	actions: { /* Hier kommen nur noch Theme-spezifische Aktionen rein */ },
	domMap: {
		// Nur noch funktionale Reste, keine Layout-Mapping-Keys mehr!
		loginUsername: '#login_username',
		cactiAuthBody: '.cactiAuthBody'
	},
	cache: {
		classes:    [],
		path:       'include/js/navigationBox/',
		storage:    Storages.localStorage,
		tap:        { count: 0, clientX: 0, clientY: 0 },
		colorListenerActive: false,
		ajaxAnchorsActive: false
	}
};

mdw.cache.colorListener = (e) => {
	const isDark = mdw.cache.systemQuery.matches;
	mdw.actions.checkThemeColorSetup(isDark ? 'dark' : 'light');
};

document.addEventListener('mdw:pluginStateUpdate', (e) => {
	// in VanillaJS CustomEvent-Data is available in .detail
	const data = e.detail || e.originalEvent?.detail;

	const { nav: navManager, btn: btnManager } = mdw.obj.ctrl;

	// sync Button visibility
	if (typeof btnManager?.show === 'function') {
		data.hasContent ? btnManager.show(data.helper) : btnManager.hide(data.helper);
	}

	// sync Box Presence
	if (typeof navManager?.setBoxPresence === 'function') {
		navManager.setBoxPresence(data.helper, data.hasContent);
	}
});

/**
 * main entry point for applying all session-based theme settings
 * modernized to use native batch updates
 */
mdw.actions.applyThemeState = function() {
	const storage = mdw.cache.storage;

	// handle data retrieval from local storage
	if (!storage || !storage.isSet('midWinter')) {
		if (typeof refreshLocalStorage === 'function') refreshLocalStorage();
	} else {
		try {
			mdw.session = JSON.parse(lzjs.decompress(storage.get('midWinter')));
		} catch (e) {
			console.error('[Midwinter] storage corruption, resetting...');
			if (typeof refreshLocalStorage === 'function') refreshLocalStorage();
		}
	}

	// apply attributes to documentElement (ui logic)
	const theme = mdw.session.theme;
	const attrs = {
		'theme-color':       theme.color.mode,
		'theme-color-auto':  theme.color.auto,
		'zoom-level':        theme.font.zoom,
		'animations':        theme.boxes.animated,
		'auto-table-layout': theme.mobile.autoTableLayout,
		'controls-subtitle': theme.controls.subTitle
	};

	// batch update data-attributes using native forEach
	Object.keys(attrs).forEach(key => {
		setDocumentAttribute(key, attrs[key]);
	});

	mdw.actions.checkPWADisplayMode();
};



/**
 * handles the one-time loading of all theme dependencies
 * @returns {Promise}
 */
async function initMidwinter() {
	// return immediately if core plugins are already in cache
	if (mdw.cache.classes.includes('navigationBox.filter')) {
		return;
	}

	try {

		// load Mindy always first
		await loadScript('mindy', 'include/interaction/mindy.js');

		// load configuration and core logic second
		await Promise.all([
			loadScript('config', 'include/themes/midwinter/config.js'),
			loadScript('navigationBox', mdw.cache.path + 'navigationBox.js')
		]);

		// load all navigation plugins in parallel
		await Promise.all([
			loadScript('navigationBox.help', mdw.cache.path + '/plugins/navigationBox.help.js'),
			loadScript('navigationBox.menu', mdw.cache.path + '/plugins/navigationBox.menu.js'),
			loadScript('navigationBox.tree', mdw.cache.path + '/plugins/navigationBox.tree.js'),
			loadScript('navigationBox.tableLayout', mdw.cache.path + '/plugins/navigationBox.tableLayout.js'),
			loadScript('navigationBox.filter', mdw.cache.path + '/plugins/navigationBox.tableFilter.js'),
			// load theme specific plugin from the theme directory
			loadScript('navigationBox.theme', 'include/themes/midwinter/navigationBox.theme.js')
		]);

	} catch (error) {
		console.error('[Midwinter] bootstrap failed', error);
	}
}

function themeReady() {
	mdw.actions.applyThemeState();

	initMidwinter().then(() => {
		setupTheme();

		// register transformers
		registerMindyTransformers();

		// Setup Mindy State
		Mindy.state.destructionList = [
			'.cactiPageHead',
			'.cactiShadow',
			'.stickyContainer',
			'.cactiConsoleNavigationArea',
			'body > .dropdownMenu'
		];

		Mindy.ui.layout.map = {
			// paket service (plugins)
			'form.cactiFilter':     'nav-filter',

			// direct relocations
			'#navigation_right'							: '#mdw-Main',
			'#main div.navBarNavigation:first-of-type'  : 'anchor-tableNavBarOnTop',
			'#main div.saveRow'							: 'anchor-tableActionOnTop',
		};

		// global listeners
		updateAjaxAnchors();

		// start Mindy
		Mindy.init();
		Mindy.ux.hotkeys.init();

		themeLoader('off');
	});
}

/**
 * Mindy Transformers: Surgical DOM modifications
 */
function registerMindyTransformers() {
	// The Master Table Surgeon
	Mindy.ui.transformers.add('#main', ($main) => {
		const $titleRow = $main.find('div.cactiTableTitleRow').first();

		if ($titleRow.length) {
			const $titleAnchor = $('[data-mindy-anchor="anchor-tableTitleOnTop"]');
			if ($titleAnchor.is(':empty')) {
				Mindy.ui.layout.relocate($titleRow.find(".cactiTableTitle").first(), 'anchor-tableTitleOnTop');
				Mindy.ui.layout.relocate($titleRow.find(".cactiTableAction"), 'anchor-tableActionOnTop');
				Mindy.ui.layout.relocate($titleRow.find(".cactiTableButton"), 'anchor-ActionBarMiddle');
				Mindy.ui.layout.relocate($("#main div.actionsDropdown > div > span"), 'anchor-tableActionOnTop');
				$titleRow.remove()
			}
		}
	});

	// Tab Relocator (Modernized)
	Mindy.ui.transformers.add('div.tabs', ($tabs) => {
		const $tabContainer = $tabs.closest('div');
		if ($tabContainer.length) {
			Mindy.ui.layout.relocate($tabContainer, 'anchor-tableTabsOnTop');
		}
	});

	// Form & Input Modernization
	Mindy.ui.transformers.add('input[type="text"], input[type="password"], textarea, input[type="checkbox"]', ($el) => {
		$el.addClass('ui-state-default ui-corner-all');

		// Search Filter logic (Handles filter, filterd, rfilter etc.)
		if ($el.is('[id^="filter"], [id^="rfilter"]') && !$el.next().hasClass('ti-search')) {
			$el.after('<i class="ti ti-search filter"></i>');
			$el.attr({ 'autocomplete': 'off', 'placeholder': 'Search...' });
			$el.closest('td').css('white-space', 'nowrap'); // Original fix from setupDefaultElements
		}
	});

	// Legacy Fixes
	Mindy.ui.transformers.add('tr[id*="line"]:not(.disabled_row) .formCheckboxLabel', ($label) => {
		$label.removeAttr('for');
	});

	// PopOver Finisher
	Mindy.ui.transformers.add('#mdw-GridContainer-PopOver', ($popover) => {
		if ($popover.hasClass('hidden')) return;
		// Make it draggable once it appears
		if (!$popover.hasClass('ui-draggable')) {
			$popover.draggable({ containment: '#mdw-GridContainer', scroll: false });
		}
		$popover.find('input[type="button"], button').addClass('ui-button ui-corner-all');
		$popover.find('.ui-dialog-titlebar-close').hide();
	});

}

/**
 * PWA Display Mode tracking
 */
mdw.actions.checkPWADisplayMode = function() {
	// initial setup
	let displayModeQuery = window.matchMedia('(display-mode: standalone)');
	setDocumentAttribute('theme-pwa', (displayModeQuery.matches) ? 'on' : 'off' );

	// monitor changes
	displayModeQuery.addEventListener('change', (e) => {
		setDocumentAttribute('theme-pwa', (e.matches) ? 'on' : 'off' );

	});
}

/**
 * AJAX Navigation & Context Push
 */
function updateAjaxAnchors() {
	// singleton guard: only attach the global delegate once
	if (mdw.cache.ajaxAnchorsActive) return;

	document.addEventListener('click', function(event) {
		// 1. check if the click should be captured
		if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;

		// 2. find the closest matching anchor
		const anchor = event.target.closest('a.pic, a.linkOverDark, a.linkEditMain, a.console, a.hyperLink, a.tab');
		if (!anchor) return;

		const href = anchor.getAttribute('href');

		// 3. validation check
		if (!href || href === '#' || href.startsWith('http') || anchor.getAttribute('target') === '_blank' || href.startsWith('mailto:')) {
			return;
		}

		// --- MINDY INTERACTION LAYER: CONTEXT PUSH ---
		if (typeof Mindy !== 'undefined') {
			const $anchor = $(anchor);
			const $parentBox = $anchor.closest('[class*="ConsoleNavigationBox"]');

			// Extrahiere Informationen für den Breadcrumb-Sync
			const label = anchor.textContent.trim();
			const category = $anchor.closest('.menuitem').find('.menu_parent span').text().trim() || '';
			const rubric = $parentBox.data('title') || 'Console';
			const helper = $parentBox.data('helper') || 'general';

			Mindy.setContext({
				rubric:   rubric,
				category: category,
				action:   label,
				helper:   helper
			});
		}

		// 4. take control: prevent Cacti's native ajaxAnchors() from firing
		event.preventDefault();
		event.stopImmediatePropagation(); // Jetzt sicher wieder aktiv

		/* midwinter specific ui logic */
		if (anchor.classList.contains('pic')) {
			document.querySelectorAll('a.pic.selected').forEach(el => el.classList.remove('selected'));
			anchor.classList.add('selected');
		}

		/* handle mobile/sidebar logic */
		if (window.innerWidth < 640 && typeof menuHide === 'function') {
			menuHide(false);
		}

		// close midwinter console navigation boxes (keep UI clean)
		const sideBarBoxes = document.querySelectorAll('#mdw-SideBarContainer [class^="mdw-ConsoleNavigationBox"]');
		sideBarBoxes.forEach(box => {
			box.classList.remove('visible');
			box.setAttribute('data-status', 'closed');
		});

		/* determine pageName for cacti global scope */
		if (typeof basename === 'function') {
			window.pageName = basename(href);
		}

		/* trigger cacti's internal loader */
		if (typeof loadUrl === 'function') {
			loadUrl({
				url: href,
				loadType: 'loadPage'
			});
		}
	}, true); // useCapture = true is vital to stay ahead of Cacti core

	mdw.cache.ajaxAnchorsActive = true;
	console.log('[Mindy/Midwinter] Global AJAX anchor delegation active with context-push.');
}

/**
 * Mindy Theme Setup
 * Creates the grid structure and handles the one-time login rewrite.
 */
function setupTheme() {
	// Login-Rewrite
	const authArea = document.querySelector('.cactiAuthArea legend');
	if (authArea && authArea.textContent !== 'WELCOME TO CACTI') {
		const authTable = document.querySelector(mdw.domMap.cactiAuthTable);
		const authForm = document.querySelector(mdw.domMap.cactiAuthForm);
		const authBody = document.querySelector(mdw.domMap.cactiAuthBody);

		if (authTable && authForm) {
			authArea.textContent = 'WELCOME TO CACTI';
			authForm.insertAdjacentHTML('afterbegin', '<input id="suppress_autofocus" type="text" style="display:none;" tab-index="-1" autofocus>');

			const pwdPlaceholders = { 'current': 'Current Password', 'password': 'New Password', 'password_confirm': 'Confirm Password' };

			authTable.querySelectorAll('input, button, label').forEach(el => {
				const id = el.id;
				authForm.appendChild(el);
				if (el.getAttribute('type') === 'password' && pwdPlaceholders[id]) {
					el.setAttribute('placeholder', pwdPlaceholders[id]);
					el.insertAdjacentHTML('afterend', `<i class="ti ti-lock" data-helper="${id}" data-func="togglePwdInputField"></i>`);
				}
			});

			const welcomeCell = authTable.querySelector('td');
			if (welcomeCell) authForm.insertAdjacentHTML('afterbegin', `<span>${welcomeCell.innerHTML}</span>`);

			const versionInfo = document.querySelector(mdw.domMap.versionInfo);
			if (versionInfo) authBody.appendChild(versionInfo);

			const loginUser = document.querySelector(mdw.domMap.loginUsername);
			if (loginUser) loginUser.insertAdjacentHTML('afterend', '<i class="ti ti-user"></i>');

			authTable.remove();
		}
	}

	// Layout Redesign (The Grid Skeleton)
	if (!document.getElementById('mdw-GridContainer')) {
		const gridHTML = `
			<div id="mdw-GridContainer" class="mdw-GridContainer">
				<div id="mdw-GridContainer-Overlay" class="mdw-GridContainer-Overlay mdw-PopOver hidden"></div>
				
				<div id="mdw-GridContainer-PopOver" class="mdw-GridContainer-PopOver mdw-PopOver hidden">
					<div id="mdw-PopOverTitle" data-mindy-anchor="anchor-popoverTitle" class="mdw-PopOverElements mdw-PopOverTitle"></div>
					<div id="mdw-PopOverContent" data-mindy-anchor="anchor-popoverContent" class="mdw-PopOverElements mdw-PopOverContent"></div>
					<div id="mdw-PopOverFooter" data-mindy-anchor="anchor-popoverFooter" class="mdw-PopOverElements mdw-PopOverFooter"></div>
				</div>
		
				<div id="mdw-ConsoleNavigation" class="mdw-ConsoleNavigation">
					<div class="compact_nav_icon_menu" id="compact_nav_main">
						<div class="compact_nav_icon hint--info hint--right hint--rounded" 
							 data-subtitle="Console" id="navBackdrop" aria-label="Console" 
							 role="button" tabindex="0"><div class="navBackdrop"></div>
						</div>
					</div>
					<div class="compact_nav_icon_menu" id="compact_tab_menu"></div>
					<div class="compact_nav_icon_menu" id="compact_user_menu"></div>
				</div>
		
				<div id="mdw-ConsolePageHead" class="mdw-ConsolePageHead">
					<div id="navBreadCrumb" class="navBreadCrumb">
						<div class="home"><a href="${urlPath}index.php" class="pic">Home</a></div>
    					<div class="rubric"><span data-mindy-context="rubric"></span></div>
    					<div class="category"><span data-mindy-context="category"></span></div>
    					<div class="action"><span data-mindy-context="action"></span></div>
					</div>
					<div id="navSearch" data-mindy-anchor="anchor-navSearch" class="navSearch"></div>
					<div id="navFilter" data-mindy-anchor="anchor-navFilter" class="navFilter"></div>
					<div id="navControl" data-mindy-anchor="anchor-navControl" class="navControl"></div>
				</div>
		
				<div id="mdw-Main" class="mdw-Main">
					<div id="elementsOnTop" class="elementsOnTop">
						<div id="tableTitleOnTop" data-mindy-anchor="anchor-tableTitleOnTop" class="elementOnTop tableTitleOnTop"></div>
						<div id="tableNavBarOnTop" data-mindy-anchor="anchor-tableNavBarOnTop" class="elementOnTop tableNavBarOnTop"></div>
						<div id="tableActionOnTop" data-mindy-anchor="anchor-tableActionOnTop" class="elementOnTop tableActionOnTop"></div>
						<div id="tableTabsOnTop" data-mindy-anchor="anchor-tableTabsOnTop" class="elementOnTop tableTabsOnTop"></div>
					</div>
				</div>
		
				<div id="mdw-ActionBar" class="mdw-ActionBar">
					<div id="mdw-ActionBarTop" data-mindy-anchor="anchor-ActionBarTop" class="mdw-ActionBarTop"></div>
					<div id="mdw-ActionBarMiddle" data-mindy-anchor="anchor-ActionBarMiddle" class="mdw-ActionBarMiddle"></div>
					<div id="mdw-ActionBarBottom" data-mindy-anchor="anchor-ActionBarBottom" class="mdw-ActionBarBottom"></div>
				</div>
			</div>`;


		document.body.insertAdjacentHTML('afterbegin', gridHTML);

		// Back-to-Console Listener
		document.getElementById('navBackdrop')?.addEventListener('click', () => {
			if (typeof loadUrl === 'function' && window.cactiConsoleAllowed) {
				loadUrl({ url: urlPath + 'index.php' });
			}
		});
	}

	// Controller Initialization (Singleton)
	if (typeof cactiNavigation === 'function' && !mdw.obj.ctrl.nav) {
		// B: Jetzt erst die Instanzen erstellen
		mdw.obj.ctrl.nav = new cactiNavigation({
			dock: { enabled: true, top: true, left: true, right: true, bottom: true },
			container: 'mdw-SideBarContainer'
		});
		mdw.obj.ctrl.box = new cactiBox();
		mdw.obj.ctrl.btn = new cactiButton();

		// Process configurations from config.js
		const processedBoxConfigs = midwinter.navigationBox.buildConfigs(uiConfig.boxes);

		uiConfig.buttons.forEach(btn => mdw.obj.ctrl.btn.add(btn));
		processedBoxConfigs.forEach(box => {
			mdw.obj.ctrl.box.add(box);
			mdw.obj.ctrl.box.restore(box.helper);
		});
	}

	/* 4. Cleanup Legacy */
	document.getElementById('menu_main_console')?.remove();
	document.querySelectorAll('a.menu_parent').forEach(el => {
		el.classList.remove('mdw-active');
		el.inert = true;
	});
}



function setupThemeActions() {
	document.addEventListener("fullscreenchange", fullScreenChangeHandler);
}

function togglePwdInputField(event) {
	// get helper id from data attribute
	const helper = event.target.getAttribute('data-helper');

	// find destination input via native id selector
	const destination = document.getElementById(helper);

	if (destination) {
		// toggle between password and text type
		if (destination.type === 'password') {
			destination.type = 'text';
		} else {
			destination.type = 'password';
		}

		// toggle icon classes using native classList
		event.target.classList.toggle('ti-lock');
		event.target.classList.toggle('ti-lock-off');
	}
}

function refreshLocalStorage() {
    mdw.cache.storage.set('midWinter', lzjs.compress(JSON.stringify(mdw.session)));
}

/**
 * sets a data attribute on the document element
 * @param {string} name - attribute name (without data- prefix)
 * @param {string} value - value to set
 */
function setDocumentAttribute(name, value) {
	// native setAttribute on <html> element
	document.documentElement.setAttribute('data-' + name, value);
	// update CSS variable
	if (name === 'zoom-level') {
		document.documentElement.style.setProperty('--mdw-zoom', value + '%');
	}
}

/**
 * retrieves a data attribute from the document element
 * @param {string} name - attribute name (without data- prefix)
 * @returns {string|null}
 */
function getDocumentAttribute(name) {
	// native getAttribute from <html> element
	return document.documentElement.getAttribute('data-' + name);
}

function themeLoader(state='off', force = false) {
	if (state === 'on') {
		if (getDocumentAttribute('data-theme-state') !== 'ready' || force === true) {
			setDocumentAttribute('theme-state', 'loading');
		}
	} else {
		setDocumentAttribute('theme-state', 'ready');
	}
}

/**
 * Mindy-enhanced PopOver preparation
 */
function preparePopOver(html) {
	$('[data-mindy-anchor^="anchor-popover"]').empty();

	const $temp = $('<div>').html(html);

	// use Mindy to relocate elements into the PopOver anchors
	// this ensures consistency and prevents stacking bugs
	Mindy.ui.layout.relocate($temp.find('.cactiTableTitleRow'), 'anchor-popoverTitle');
	Mindy.ui.layout.relocate($temp.find('.saveRow'), 'anchor-popoverFooter');

	// set main content
	$('#mdw-PopOverContent').html($temp.html());

	// sanitize Buttons (Cancel/Confirm)
	const $popover = $('#mdw-GridContainer-PopOver');
	$popover.find('button[value="cancel"]').off('click').on('click', (e) => {
		e.preventDefault();
		togglePopOver(false);
	});

	if ($popover.find('#action_confirm').length) {
		$popover.find('#action_confirm').off('submit').on('submit', () => togglePopOver(false));
	}

	togglePopOver(true);
}

/**
 * toggles the visibility of the popover and its overlay
 * @param {boolean|null} force - optional state to enforce
 */
function togglePopOver(force) {
	// get all elements with the popover class (container and overlay)
	const popovers = document.querySelectorAll('.mdw-PopOver');

	popovers.forEach(el => {
		if (typeof force === 'boolean') {
			// enforce specific state if provided
			if (force === true) {
				el.classList.remove('hidden');
			} else {
				el.classList.add('hidden');
			}
		} else {
			// toggle class if no force state is defined
			el.classList.toggle('hidden');
		}
	});
}

/* --- Navigation & UX Actions --- */
mdw.actions.fullScreen = function() {
	if (!document.fullscreenElement) {
		document.documentElement.requestFullscreen().then(() => mdw.actions.fullScreenChangeHandler());
	} else if (document.exitFullscreen) {
		document.exitFullscreen().then(() => mdw.actions.fullScreenChangeHandler());
	}
};

mdw.actions.fullScreenChangeHandler = function() {
	const icon = document.querySelector('.compact_nav_icon[data-helper="fullScreen"] > i');
	if (!icon) return;
	const isFull = !!document.fullscreenElement;
	icon.classList.toggle('ti-maximize', !isFull);
	icon.classList.toggle('ti-minimize', isFull);
};

function kioskMode(event = false) {
	const mainElement = document.querySelector(mdw.domMap.mdwMain);
	const btnManager = mdw.obj.ctrl.btn;

	if (event === false) {
		setDocumentAttribute('kiosk-mode', 'off');

		if (mainElement) {
			mainElement.removeEventListener('click', handleKioskClick);
		}
		mdw.cache.tap.count = 0;
	} else {
		// use button manager to close open console navigation box
		if (btnManager && typeof btnManager.toggleConsoleNavigationBox === 'function') {
			btnManager.toggleConsoleNavigationBox(event);
		}

		setDocumentAttribute('kiosk-mode', 'on');

		if (typeof isMobile !== 'undefined' && isMobile.any() !== null && mainElement) {
			mainElement.addEventListener('click', handleKioskClick);
		}
	}
}

/**
 * separate handler for double-tap detection
 */
function handleKioskClick(e) {
	mdw.cache.tap.count++;

	if (mdw.cache.tap.count === 1) {
		mdw.cache.tap.clientX = e.clientX;
		mdw.cache.tap.clientY = e.clientY;

		mdw.cache.tap.timer = setTimeout(function() {
			mdw.cache.tap.count = 0;
		}, 300);

	} else if (mdw.cache.tap.count === 2) {
		if (Math.abs(e.clientX - mdw.cache.tap.clientX) < 20 && Math.abs(e.clientY - mdw.cache.tap.clientY) < 20) {
			e.preventDefault();
			clearTimeout(mdw.cache.tap.timer);
			kioskMode(false);
		} else {
			mdw.cache.tap.count = 1;
			mdw.cache.tap.clientX = e.clientX;
			mdw.cache.tap.clientY = e.clientY;
		}
	}
}

/**
 * loads scripts via native dom injection and returns a promise
 * @param {string} className - unique name for the class
 * @param {string} url - relative path to the script
 * @returns {Promise} resolves when script is loaded
 */
function loadScript(className, url = '') {
	if (mdw.cache.classes.includes(className)) {
		return Promise.resolve();
	}

	return new Promise((resolve, reject) => {
		if (typeof urlPath === 'undefined' || !urlPath) {
			const location = window.location.pathname;
			const dirname = location.substring(0, location.lastIndexOf("/") + 1);
			urlPath = (dirname.search('/install/') !== -1) ? dirname + '../' : dirname;
		}

		const script = document.createElement('script');
		script.src = urlPath + url;
		script.async = false; // keep order

		script.onload = () => {
			mdw.cache.classes.push(className);
			resolve();
		};

		script.onerror = () => {
			console.error(`[Midwinter] failed to load: ${className}`);
			reject();
		};

		document.head.appendChild(script);
	});
}

/**
 * loads a specific element from a remote url using the fetch api
 * @param {string} elementName - the id of the element to extract
 * @param {string} url - the relative url to fetch from
 * @param {boolean} content_only - if true, only returns the inner html
 * @returns {Promise<string>}
 */
async function loadElement(elementName, url = '', content_only = false) {
	try {
		const path = (typeof urlPath !== 'undefined') ? urlPath : '';

		// fetch naturally includes cookies for same-origin requests
		const response = await fetch(path + url, {
			method: 'GET',
			cache: 'no-cache'
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const html = await response.text();

		// parse html string natively
		const temp = document.createElement('div');
		temp.innerHTML = html;
		const targetElement = temp.querySelector('#' + elementName);

		if (!targetElement) {
			return '';
		}

		return content_only ? targetElement.innerHTML : targetElement.outerHTML;

	} catch (error) {
		console.error(`[Mindy/Plugin] loadElement failed for ${elementName}:`, error);
		return '';
	}
}



registry.midwinter = {
	navigationBox : {
		content: {
			help: function() {
				return '<ul class="nav">'
						+   '<li class="menuitem" id="menu_user_help">'
						+       '<a class="menu_parent" href="#" inert>'
						+           '<i class="menu_glyph ti ti-book"></i>'
						+           '<span>'+cactiGeneral+'</span>'
						+       '</a>'
						+       '<ul>'
						+           '<li><a class="pic" role="menuitem" href="'+urlPath+'about.php">'+aboutCacti+'</a></li>'
						+           '<li><a href="https://github.com/Cacti/documentation/blob/develop/README.md" target="_blank" rel="noopener noreferrer">'+cactiDocumentation+'</a></li>'
						+           '<li><a href="https://github.com/cacti" target="_blank" rel="noopener noreferrer">'+cactiProjectPage+'</a></li>'
						+           '<li><a href="https://www.cacti.net" target="_blank" rel="noopener noreferrer">'+cactiHome+'</></a></li>'
						+       '</ul>'
						+   '</li>'
						+   '<li class="menuitem" id="menu_user_issues">'
						+       '<a class="menu_parent" href="#" inert>'
						+           '<i class="menu_glyph ti ti-bug"></i>'
						+           '<span>'+reportABug+'</span>'
						+       '</a>'
						+       '<ul>'
						+           '<li><a href="https://github.com/Cacti/cacti/issues/new/choose" target="_blank" rel="noopener noreferrer">'+justCacti+'</></a></li>'
						+           '<li><a href="https://github.com/Cacti/documentation/issues/new/choose" target="_blank" rel="noopener noreferrer">'+cactiDocumentation+'</></a></li>'
						+           '<li><a href="https://github.com/Cacti/spine/issues/new/choose" target="_blank" rel="noopener noreferrer">'+cactiSpine+'</a></li>'
						+           '<li><a href="https://github.com/Cacti/rrdproxy/issues/new/choose" target="_blank" rel="noopener noreferrer">'+cactiRRDProxy+'</a></li>'
						+       '</ul>'
						+   '</li>'
						// +   '<li class="menuitem" id="menu_user_shortcuts">'
						// +       '<a class="menu_parent" href="#" inert>'
						// +           '<i class="menu_glyph ti ti-keyboard"></i>'
						// +           '<span>'+cactiKeyboard+'</span>'
						// +       '</a>'
						// +       '<ul>'
						// +           '<li><a href="#" class="dialog_client" data-scope="theme" data-func="togglePopOver">'+cactiShortcuts+'</a></li>'
						// +       '</ul>'
						// +   '</li>'
						+   '<li class="menuitem" id="menu_user_help">'
						+       '<a class="menu_parent" href="#" inert>'
						+           '<i class="menu_glyph ti ti-heart-handshake"></i>'
						+           '<span>'+cactiContributeTo+'</span>'
						+       '</a>'
						+       '<ul>'
						+           '<li><a href="https://forums.cacti.net/" target="_blank" rel="noopener noreferrer">'+cactiCommunityForum+'</a></li>'
						+           '<li><a href="https://github.com/cacti" target="_blank" rel="noopener noreferrer">'+cactiDevHelp+'</a></li>'
						+           '<li><a href="https://www.cacti.net/development/contribute" target="_blank" rel="noopener noreferrer">'+cactiDonate+'</a></li>'
						+           '<li><a href="https://translate.cacti.net" target="_blank" rel="noopener noreferrer">'+cactiTranslate+'</a></li>'
						+       '</ul>'
						+   '</li>'
						+   '</ul>';
			},
			user: function() {
					return '<ul class="nav">'
						+   '<li class="menuitem" id="menu_user_action">'
						+       '<a class="menu_parent" href="#" inert>'
						+           '<i class="menu_glyph ti ti-user-edit""></i>'
						+           '<span>'+cactiProfile+'</span>'
						+       '</a>'
						+       '<ul>'
						+           '<li><a class="pic" role="menuitem" href="'+urlPath+'auth_profile.php?action=edit&header=false">'+editProfile+'</a></li>'
						+           '<li><a href="'+urlPath+'auth_changepassword.php" style="">'+changePassword+'</a></li>'
						+           '<li><a href="'+urlPath+'logout.php">'+logout+'</a></li>'
						+       '</ul>'
						+   '</li>';
			}
		}
	}
}