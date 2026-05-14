// js/router.js

import { el } from "./dom.js";
import { enterHome } from "./pages/home.js";
import { enterStoragePage } from "./pages/storage.js";
import { enterMarketingPage } from "./pages/marketing.js";
import { enterOrdersPage } from "./pages/orders.js";
import { enterChatPage } from "./pages/chat.js";

import {
  prewarmMarketingP5Live,
  setMarketingP5PageActive
} from "./pages/marketingP5Live.js";

const pagesWithNav = [
  "pageHome",
  "pageStorage",
  "pageMarketing",
  "pageOrders",
  "pageChat"
];

const pagesWithGlobalHud = [];

const NAV_ICON_MAP = {
  pageHome: {
    btn: "navHome",
    normal: "assets/ui_nav/home_icon.png",
    selected: "assets/ui_nav/home_icon_selected.png"
  },
  pageStorage: {
    btn: "navStorage",
    normal: "assets/ui_nav/storage_icon.png",
    selected: "assets/ui_nav/storage_icon_selected.png"
  },
  pageMarketing: {
    btn: "navMarketing",
    normal: "assets/ui_nav/livestream_icon.png",
    selected: "assets/ui_nav/livestream_icon_selected.png"
  },
  pageOrders: {
    btn: "navOrders",
    normal: "assets/ui_nav/orders_icon.png",
    selected: "assets/ui_nav/orders_icon_selected.png"
  },
  pageChat: {
    btn: "navChat",
    normal: "assets/ui_nav/chat_icon.png",
    selected: "assets/ui_nav/chat_icon_selected.png"
  }
};

let marketingPrewarmed = false;

function maybePrewarmMarketing(pageId) {
  if (marketingPrewarmed) return;

  const canPrewarmFromPages = [
    "pageHome",
    "pageStorage",
    "pageOrders",
    "pageChat"
  ];

  if (!canPrewarmFromPages.includes(pageId)) return;

  marketingPrewarmed = true;

  setTimeout(() => {
    prewarmMarketingP5Live();
  }, 100);
}

export function showNavBar() {
  el.bottomNav?.classList.remove("hidden");
}

export function hideNavBar() {
  el.bottomNav?.classList.add("hidden");
}

export function showHud() {
  el.hud?.classList.remove("hidden");
}

export function hideHud() {
  el.hud?.classList.add("hidden");
}

function updateNavIcons(activePageId) {
  Object.entries(NAV_ICON_MAP).forEach(([pageId, config]) => {
    const btn = el[config.btn];
    if (!btn) return;

    const img = btn.querySelector("img");
    if (!img) return;

    img.src = pageId === activePageId ? config.selected : config.normal;
  });
}

export function showPage(pageId) {
  const isMarketing = pageId === "pageMarketing";

  document.querySelectorAll(".page").forEach((p) => {
    p.classList.remove("show");
  });

  const page = document.getElementById(pageId);
  if (page) page.classList.add("show");

  // Prepare camera after player enters normal gameplay pages.
  maybePrewarmMarketing(pageId);

  // Important: activate camera AFTER the page is shown.
  requestAnimationFrame(() => {
    setMarketingP5PageActive(isMarketing);
  });

  if (pagesWithNav.includes(pageId)) {
    showNavBar();
    updateNavIcons(pageId);
  } else {
    hideNavBar();
    updateNavIcons("");
  }

  if (pagesWithGlobalHud.includes(pageId)) {
    showHud();
  } else {
    hideHud();
  }
}

export function isOnHomePage() {
  return !!el.pageHome?.classList.contains("show");
}

export function initNav() {
  if (el.navHome) {
    el.navHome.onclick = () => {
      showPage("pageHome");
      enterHome();
    };
  }

  if (el.navStorage) {
    el.navStorage.onclick = () => {
      showPage("pageStorage");
      enterStoragePage();
    };
  }

  if (el.navMarketing) {
    el.navMarketing.onclick = () => {
      showPage("pageMarketing");
      enterMarketingPage();
    };
  }

  if (el.navOrders) {
    el.navOrders.onclick = () => {
      showPage("pageOrders");
      enterOrdersPage();
    };
  }

  if (el.navChat) {
    el.navChat.onclick = () => {
      showPage("pageChat");
      enterChatPage();
    };
  }
}