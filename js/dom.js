// js/dom.js

export const el = {
  appRoot: document.getElementById("appRoot"),

  // pages
  pageStart: document.getElementById("pageStart"),
  pageManager: document.getElementById("pageManager"),
  pageTutorial: document.getElementById("pageTutorial"),
  pageSetup: document.getElementById("pageSetup"),
  pageProducts: document.getElementById("pageProducts"),
  pagePricing: document.getElementById("pagePricing"),
  pageHome: document.getElementById("pageHome"),
  pageStorage: document.getElementById("pageStorage"),
  pageMarketing: document.getElementById("pageMarketing"),
  pageOrders: document.getElementById("pageOrders"),
  pageChat: document.getElementById("pageChat"),

  // HUD
  hud: document.getElementById("hud"),
  hudAvatar: document.getElementById("hudAvatarImg"),
  hudStoreName: document.getElementById("hudStoreName"),
  hudRating: document.getElementById("hudRating"),
  hudFollowers: document.getElementById("hudFollowers"),
  hudDay: document.getElementById("hudDay"),
  hudTimeLeft: document.getElementById("hudTimeLeft"),
  hudRevenue: document.getElementById("hudRevenue"),
  hudViews: document.getElementById("hudViews"),


  // manager
  managerBtn: document.getElementById("managerBtn"),
  managerBackBtn: document.getElementById("managerBackBtn"),

  managerWelcomeName: document.getElementById("managerWelcomeName"),
  managerDayIcon: document.getElementById("managerDayIcon"),
  managerDayText: document.getElementById("managerDayText"),
  managerTimeText: document.getElementById("managerTimeText"),

  managerProfileAvatar: document.getElementById("managerProfileAvatar"),
  managerProfileStoreName: document.getElementById("managerProfileStoreName"),
  managerProfileSellerId: document.getElementById("managerProfileSellerId"),
  managerProfileRegion: document.getElementById("managerProfileRegion"),
  managerProfileStoreType: document.getElementById("managerProfileStoreType"),

  managerStarsImg: document.getElementById("managerStarsImg"),
  managerAwaitingShipment: document.getElementById("managerAwaitingShipment"),
  managerFollowers: document.getElementById("managerFollowers"),
  managerRevenue: document.getElementById("managerRevenue"),
  managerDeliverySpeed: document.getElementById("managerDeliverySpeed"),
  managerChatSpeed: document.getElementById("managerChatSpeed"),
  managerOrdersToday: document.getElementById("managerOrdersToday"),
  managerManufacturingCost: document.getElementById("managerManufacturingCost"),
  managerTotalViews: document.getElementById("managerTotalViews"),
  managerTotalOrders: document.getElementById("managerTotalOrders"),
  managerChartSvg: document.getElementById("managerChartSvg"),
  managerBestProducts: document.getElementById("managerBestProducts"),

  managerHealthStatus: document.getElementById("managerHealthStatus"),
  managerHealthMessage: document.getElementById("managerHealthMessage"),
  managerHealthNeedle: document.getElementById("managerHealthNeedle"),
  managerHealthAvatar: document.getElementById("managerHealthAvatar"),

  managerWarningPopup: document.getElementById("managerWarningPopup"),
  managerWarningCloseBtn: document.getElementById("managerWarningCloseBtn"),
  managerWarningIconImg: document.getElementById("managerWarningIconImg"),
  managerWarningText: document.getElementById("managerWarningText"),

  // toast
  algoToast: document.getElementById("algoToast"),
  algoToastAvatar: document.getElementById("algoToastAvatar"),
  algoToastName: document.getElementById("algoToastName"),
  algoToastText: document.getElementById("algoToastText"),
  closeAlgoToastBtn: document.getElementById("closeAlgoToastBtn"),

  // start
  startBtn: document.getElementById("startBtn"),

  // Add inside el object
tutorialBackBtn: document.getElementById("tutorialBackBtn"),
tutorialNextBtn: document.getElementById("tutorialNextBtn"),

  // setup page
  backToStartBtn: document.getElementById("backToStartBtn"),
  goToProductsBtn: document.getElementById("goToProductsBtn"),
  setupMessage: document.getElementById("setupMessage"),

  // products page
  productsPrevBtn: document.getElementById("productsPrevBtn"),
  productsNextBtn: document.getElementById("productsNextBtn"),
  productsMessage: document.getElementById("productsMessage"),
  productsGrid: document.getElementById("productsGrid"),
  shippingPurchaseRow: document.getElementById("shippingPurchaseRow"),

  // pricing page
  pricingPrevBtn: document.getElementById("pricingPrevBtn"),
  pricingNextBtn: document.getElementById("pricingNextBtn"),
  pricingPickerWrap: document.getElementById("pricingPickerWrap"),
  pricingMessage: document.getElementById("pricingMessage"),
  pricingCardWrap: document.getElementById("pricingCardWrap"),
  setupStoreFinalBtn: document.getElementById("setupStoreFinalBtn"),

  // home
  homeProducts: document.getElementById("homeProducts"),
  homeHelperBar: document.getElementById("homeHelperBar"),
  homeHelperName: document.getElementById("homeHelperName"),
  homeHelperTimer: document.getElementById("homeHelperTimer"),
  homeHelperFill: document.getElementById("homeHelperFill"),

  // shipping button
  shippingBtn: document.getElementById("shippingBtn"),
  shippingMat: document.getElementById("shippingMat"),

  // nav
  bottomNav: document.getElementById("bottomNav"),
  navHome: document.getElementById("navHome"),
  navStorage: document.getElementById("navStorage"),
  navMarketing: document.getElementById("navMarketing"),
  navOrders: document.getElementById("navOrders"),
  navChat: document.getElementById("navChat"),
  navOrdersBadge: document.getElementById("navOrdersBadge"),
  navChatBadge: document.getElementById("navChatBadge"),

  // edit profile button
  editProfileBtn: document.getElementById("editProfileBtn"),
  editProfileOverlay: document.getElementById("editProfileOverlay"),
  closeEditProfileBtn: document.getElementById("closeEditProfileBtn"),
  updateProfileBtn: document.getElementById("updateProfileBtn"),
  editLargeAvatar: document.getElementById("editLargeAvatar"),
  editStoreNameInput: document.getElementById("editStoreNameInput"),
  editStoreIdDisplay: document.getElementById("editStoreIdDisplay"),
  editRegionDisplay: document.getElementById("editRegionDisplay"),
  editStoreTypeInput: document.getElementById("editStoreTypeInput"),
  editAvatarRow: document.getElementById("editAvatarRow"),

  // storage
  storageTopStats: document.getElementById("storageTopStats"),
  storageMainBlock: document.getElementById("storageMainBlock"),
  storageBottomTabBar: document.getElementById("storageBottomTabBar"),
  storageGridWrap: document.getElementById("storageGridWrap"),
  storagePageMain: document.getElementById("storagePageMain"),

  // shipping restock modal
  shippingRestockOverlay: document.getElementById("shippingRestockOverlay"),
  closeShippingRestockBtn: document.getElementById("closeShippingRestockBtn"),
  restockBudgetText: document.getElementById("restockBudgetText"),
  restockMinus: document.getElementById("restockMinus"),
  restockQty: document.getElementById("restockQty"),
  restockPlus: document.getElementById("restockPlus"),
  restockCostText: document.getElementById("restockCostText"),
  confirmRestockBtn: document.getElementById("confirmRestockBtn"),

  // marketing
  liveStreamerImg: document.getElementById("liveStreamerImg"),
  liveChatLane: document.getElementById("liveChatLane"),
  liveHeartsLane: document.getElementById("liveHeartsLane"),
  liveHoldBtn: document.getElementById("liveHoldBtn"),
  liveTimer: document.getElementById("liveTimer"),
  liveViewPill: document.getElementById("liveViewPill"),
  liveViewsCount: document.getElementById("liveViewsCount"),

  // helper overlays
  helpCardOverlay: document.getElementById("helpCardOverlay"),
  closeHelpCardBtn: document.getElementById("closeHelpCardBtn"),
  helpCardTitle: document.getElementById("helpCardTitle"),
  helpCardText: document.getElementById("helpCardText"),
  helpCardPrice: document.getElementById("helpCardPrice"),
  acceptHelpCardBtn: document.getElementById("acceptHelpCardBtn"),
  declineHelpCardBtn: document.getElementById("declineHelpCardBtn"),

  marketingHelperOverlay: document.getElementById("marketingHelperOverlay"),
  marketingHelperName: document.getElementById("marketingHelperName"),
  marketingHelperTimer: document.getElementById("marketingHelperTimer"),
  marketingHelperFill: document.getElementById("marketingHelperFill"),

  ordersHelperOverlay: document.getElementById("ordersHelperOverlay"),
  ordersHelperName: document.getElementById("ordersHelperName"),
  ordersHelperTimer: document.getElementById("ordersHelperTimer"),
  ordersHelperFill: document.getElementById("ordersHelperFill"),

  chatHelperOverlay: document.getElementById("chatHelperOverlay"),
  chatHelperName: document.getElementById("chatHelperName"),
  chatHelperTimer: document.getElementById("chatHelperTimer"),
  chatHelperFill: document.getElementById("chatHelperFill"),

  // orders
  ordersTabs: document.getElementById("ordersTabs"),
  ordersList: document.getElementById("ordersList"),

  // day overlay
  dayOverlay: document.getElementById("dayOverlay"),
  dayOverlayTitle: document.getElementById("dayOverlayTitle"),
  dayOverlayText: document.getElementById("dayOverlayText"),
  dayContinueBtn: document.getElementById("dayContinueBtn"),
};