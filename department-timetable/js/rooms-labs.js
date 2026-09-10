import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { db } from "./firebase.js";

import {
  requireAuthenticatedUser,
  enableSignOut
} from "./auth-guard.js";

import { renderNavigation } from "./layout.js";


const roomsCollection = collection(db, "rooms");

let rooms = [];
let editingRoomId = null;


// --------------------------------------------------
// INITIALISE
// --------------------------------------------------

async function initialisePage() {

  renderNavigation();

  await requireAuthenticatedUser();

  document
    .querySelector("#protectedContent")
    .removeAttribute("hidden");

  enableSignOut();

  setupEvents();

  listenForRooms();
}


// --------------------------------------------------
// EVENTS
// --------------------------------------------------

function setupEvents() {

  document
    .querySelector("#addClassroomBtn")
    .addEventListener("click", () => {
      openModal("classroom");
    });

  document
    .querySelector("#addLabBtn")
    .addEventListener("click", () => {
      openModal("lab");
    });

  document
    .querySelector("#closeModalBtn")
    .addEventListener("click", closeModal);

  document
    .querySelector("#cancelBtn")
    .addEventListener("click", closeModal);

  document
    .querySelector("#roomForm")
    .addEventListener("submit", saveRoom);

  document
    .querySelector("#roomTypeFilter")
    .addEventListener("change", renderRooms);

  document
    .querySelector("#roomsTableBody")
    .addEventListener("click", handleTableAction);
}


// --------------------------------------------------
// FIRESTORE LISTENER
// --------------------------------------------------

function listenForRooms() {

  onSnapshot(
    roomsCollection,
    (snapshot) => {

      rooms = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data()
      }));

      renderRooms();
      updateStatistics();
    },

    (error) => {

      console.error("Error loading rooms:", error);

      showMessage(
        "Unable to load rooms. Please check Firebase.",
        "error"
      );
    }
  );
}


// --------------------------------------------------
// OPEN MODAL
// --------------------------------------------------

function openModal(type, room = null) {

  const modal = document.querySelector("#roomModal");

  const title = document.querySelector("#modalTitle");
  const description = document.querySelector("#modalDescription");

  const roomType = document.querySelector("#roomType");

  const labTypeGroup = document.querySelector("#labTypeGroup");
  const batchGroup = document.querySelector("#batchGroup");

  editingRoomId = room?.id || null;

  if (room) {

    title.textContent =
      type === "lab"
        ? "Edit Lab"
        : "Edit Classroom";

    description.textContent =
      "Update the room information.";

    document.querySelector("#roomId").value = room.id;

    document.querySelector("#roomName").value =
      room.name || "";

    document.querySelector("#capacity").value =
      room.capacity || "";

    document.querySelector("#location").value =
      room.location || "";

    document.querySelector("#labType").value =
      room.labType || "";

    document.querySelector("#batches").value =
      Array.isArray(room.batches)
        ? room.batches.join(", ")
        : "";

    document.querySelector("#status").value =
      room.status || "available";

    roomType.value = type;

  } else {

    document.querySelector("#roomForm").reset();

    roomType.value = type;

    document.querySelector("#status").value =
      "available";

    title.textContent =
      type === "lab"
        ? "Add Lab"
        : "Add Classroom";

    description.textContent =
      type === "lab"
        ? "Enter laboratory details."
        : "Enter classroom details.";
  }

  const isLab = type === "lab";

  labTypeGroup.hidden = !isLab;
  batchGroup.hidden = !isLab;

  // IMPORTANT:
  // Explicitly show modal
  modal.removeAttribute("hidden");
  modal.style.display = "flex";
}


// --------------------------------------------------
// CLOSE MODAL
// --------------------------------------------------

function closeModal() {

  const modal = document.querySelector("#roomModal");

  // IMPORTANT:
  // Explicitly hide modal
  modal.style.display = "none";
  modal.setAttribute("hidden", "");

  editingRoomId = null;

  document
    .querySelector("#roomForm")
    .reset();

  document
    .querySelector("#formMessage")
    .textContent = "";

  // Reset hidden lab fields
  document
    .querySelector("#labTypeGroup")
    .hidden = true;

  document
    .querySelector("#batchGroup")
    .hidden = true;
}


// --------------------------------------------------
// SAVE ROOM
// --------------------------------------------------

async function saveRoom(event) {

  event.preventDefault();

  const saveButton =
    document.querySelector("#saveRoomBtn");

  saveButton.disabled = true;
  saveButton.textContent = "Saving...";

  try {

    const type =
      document.querySelector("#roomType").value;

    const name =
      document.querySelector("#roomName")
        .value.trim();

    const capacity =
      Number(
        document.querySelector("#capacity").value
      );

    const location =
      document.querySelector("#location")
        .value.trim();

    const labType =
      document.querySelector("#labType")
        .value.trim();

    const batchesText =
      document.querySelector("#batches")
        .value.trim();

    const status =
      document.querySelector("#status").value;


    if (!name) {
      throw new Error("Room name is required.");
    }

    if (!capacity || capacity < 1) {
      throw new Error("Enter a valid capacity.");
    }


    const batches = type === "lab"
      ? batchesText
          .split(",")
          .map(batch => batch.trim())
          .filter(Boolean)
      : [];


    const roomData = {

      name,

      type,

      capacity,

      location,

      labType:
        type === "lab"
          ? labType
          : "",

      batches,

      status,

      updatedAt:
        serverTimestamp()
    };


    if (editingRoomId) {

      await updateDoc(
        doc(db, "rooms", editingRoomId),
        roomData
      );

      showMessage(
        "Room updated successfully.",
        "success"
      );

    } else {

      roomData.createdAt =
        serverTimestamp();

      await addDoc(
        roomsCollection,
        roomData
      );

      showMessage(
        "Room added successfully.",
        "success"
      );
    }


    setTimeout(() => {
      closeModal();
    }, 500);

  } catch (error) {

    console.error(error);

    showMessage(
      error.message ||
      "Unable to save room.",
      "error"
    );

  } finally {

    saveButton.disabled = false;
    saveButton.textContent = "Save";
  }
}


// --------------------------------------------------
// RENDER TABLE
// --------------------------------------------------

function renderRooms() {

  const tbody =
    document.querySelector("#roomsTableBody");

  const filter =
    document.querySelector("#roomTypeFilter").value;


  const filteredRooms =
    rooms.filter(room => {

      if (filter === "all") {
        return true;
      }

      return room.type === filter;
    });


  if (filteredRooms.length === 0) {

    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          No rooms found.
        </td>
      </tr>
    `;

    return;
  }


  tbody.innerHTML =
    filteredRooms
      .sort((a, b) =>
        (a.name || "")
          .localeCompare(b.name || "")
      )
      .map(room => {

        const isLab =
          room.type === "lab";

        const batches =
          isLab &&
          Array.isArray(room.batches)
            ? room.batches.join(", ")
            : "-";


        return `
          <tr>

            <td>
              <strong>
                ${escapeHtml(room.name || "-")}
              </strong>
            </td>

            <td>
              ${isLab ? "Laboratory" : "Classroom"}
            </td>

            <td>
              ${room.capacity || "-"}
            </td>

            <td>
              ${escapeHtml(room.location || "-")}
            </td>

            <td>
              ${escapeHtml(room.labType || "-")}
            </td>

            <td>
              ${escapeHtml(batches)}
            </td>

            <td>
              <span class="status-badge ${
                room.status === "available"
                  ? "status-active"
                  : "status-inactive"
              }">
                ${
                  room.status === "available"
                    ? "Available"
                    : "Unavailable"
                }
              </span>
            </td>

            <td>

              <button
                type="button"
                class="btn btn-small"
                data-action="edit"
                data-id="${room.id}"
              >
                Edit
              </button>

              <button
                type="button"
                class="btn btn-small btn-danger"
                data-action="delete"
                data-id="${room.id}"
              >
                Delete
              </button>

            </td>

          </tr>
        `;
      })
      .join("");
}


// --------------------------------------------------
// TABLE ACTIONS
// --------------------------------------------------

async function handleTableAction(event) {

  const button =
    event.target.closest("button[data-action]");

  if (!button) {
    return;
  }

  const id =
    button.dataset.id;

  const action =
    button.dataset.action;

  const room =
    rooms.find(item => item.id === id);

  if (!room) {
    return;
  }


  if (action === "edit") {

    openModal(
      room.type,
      room
    );

    return;
  }


  if (action === "delete") {

    const confirmed =
      window.confirm(
        `Delete "${room.name}"?`
      );

    if (!confirmed) {
      return;
    }


    try {

      await deleteDoc(
        doc(db, "rooms", id)
      );

    } catch (error) {

      console.error(error);

      alert(
        "Unable to delete room."
      );
    }
  }
}


// --------------------------------------------------
// STATISTICS
// --------------------------------------------------

function updateStatistics() {

  const classrooms =
    rooms.filter(
      room => room.type === "classroom"
    );

  const labs =
    rooms.filter(
      room => room.type === "lab"
    );

  const available =
    rooms.filter(
      room => room.status === "available"
    );


  document.querySelector("#classroomCount")
    .textContent = classrooms.length;

  document.querySelector("#labCount")
    .textContent = labs.length;

  document.querySelector("#totalRoomCount")
    .textContent = rooms.length;

  document.querySelector("#availableCount")
    .textContent = available.length;
}


// --------------------------------------------------
// MESSAGE
// --------------------------------------------------

function showMessage(message, type) {

  const element =
    document.querySelector("#formMessage");

  element.textContent = message;

  element.className =
    `form-message ${type}`;
}


// --------------------------------------------------
// SECURITY
// --------------------------------------------------

function escapeHtml(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// --------------------------------------------------
// START
// --------------------------------------------------

initialisePage().catch(error => {

  if (
    error.message !==
    "Firebase has not been configured."
  ) {
    console.error(error);
  }

});