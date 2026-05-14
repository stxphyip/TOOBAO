import { el } from "../dom.js";
import { shopInfo } from "../state.js";
import { avatarImages } from "../data/avatars.js";
import { updateHomeProfileUI } from "../pages/home.js";
import { renderManagerDashboard } from "../pages/manager.js";
import { checkTaskCompletion } from "../systems/tasks.js";

let tempAvatarIndex = 0;

export function openEditProfile() {
  el.editProfileOverlay.classList.remove("hidden");

  // ✅ Load existing values
  el.editStoreNameInput.value = shopInfo.name || "";

  if (el.editStoreTypeInput) {
    el.editStoreTypeInput.value = shopInfo.storeType || "";
  }

  if (el.editRegionDisplay) {
    el.editRegionDisplay.textContent = shopInfo.region || "";
  }

  if (el.editStoreIdDisplay) {
    el.editStoreIdDisplay.textContent = shopInfo.id || "";
  }

  tempAvatarIndex = shopInfo.avatarNumber || 0;

  updateLargeAvatarPreview();
  buildEditAvatars();
}

function closeEditProfile() {
  el.editProfileOverlay.classList.add("hidden");
}

function updateLargeAvatarPreview() {
  if (el.editLargeAvatar) {
    el.editLargeAvatar.src = avatarImages[tempAvatarIndex];
  }
}

function buildEditAvatars() {
  el.editAvatarRow.innerHTML = "";

  avatarImages.forEach((src, i) => {
    const btn = document.createElement("button");
    btn.className = "avatarBtn";
    btn.type = "button";

    const img = document.createElement("img");
    img.className = "avatarImg";
    img.src = src;
    btn.appendChild(img);

    if (i === tempAvatarIndex) {
      const check = document.createElement("img");
      check.src = "assets/editProfile/selectedprofilecheckmark.png";
      check.className = "checkIconImg";
      btn.appendChild(check);
    }

    btn.onclick = () => {
      tempAvatarIndex = i;
      updateLargeAvatarPreview();
      buildEditAvatars();
    };

    el.editAvatarRow.appendChild(btn);
  });
}

export function initEditProfileModal() {
  if (el.closeEditProfileBtn) {
    el.closeEditProfileBtn.onclick = closeEditProfile;
  }

  // ✅ LIVE uppercase typing
  if (el.editStoreNameInput) {
    el.editStoreNameInput.addEventListener("input", () => {
      el.editStoreNameInput.value =
        el.editStoreNameInput.value.toUpperCase();
    });
  }

  if (el.editStoreTypeInput) {
    el.editStoreTypeInput.addEventListener("input", () => {
      el.editStoreTypeInput.value =
        el.editStoreTypeInput.value.toUpperCase();
    });
  }

  if (el.updateProfileBtn) {
    el.updateProfileBtn.onclick = () => {
      // ✅ SAVE uppercase values
      shopInfo.name =
        el.editStoreNameInput.value.trim().toUpperCase() || shopInfo.name;

      if (el.editStoreTypeInput) {
        shopInfo.storeType =
          el.editStoreTypeInput.value.trim().toUpperCase() ||
          shopInfo.storeType;
      }

      shopInfo.avatarNumber = tempAvatarIndex;

      updateHomeProfileUI();
      renderManagerDashboard();

      closeEditProfile();
      checkTaskCompletion();
    };
  }
}