// ============================================================
// TIMELY - SUBJECT MANAGEMENT
// Complete subjects.js
// Firebase 12.1.0
// ============================================================

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { db } from "./firebase.js";

import {
  requireAuthenticatedUser,
  enableSignOut
} from "./auth-guard.js";

import { renderNavigation } from "./layout.js";


// ============================================================
// FIRESTORE
// ============================================================

const subjectsCollection = collection(db, "subjects");

let subjects = [];
let editingSubjectId = null;


// ============================================================
// BUILT-IN SUBJECT LIST
// Based on the course structure provided for the project.
// Subject codes are intentionally left blank because reliable
// codes were not provided in the source material.
// ============================================================

const BUILT_IN_SUBJECTS = [

  // ==========================================================
  // SEMESTER III - SE
  // ==========================================================

  {
    name: "Engineering Mathematics-III",
    year: "SE",
    semester: 3,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: null
  },

  {
    name: "Electronics Devices & Circuits",
    year: "SE",
    semester: 3,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: null
  },

  {
    name: "Programming, Data Structure & Algorithm using C",
    year: "SE",
    semester: 3,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: null
  },

  {
    name: "Computer Architecture & Operating System",
    year: "SE",
    semester: 3,
    lectureHours: 3,
    tutorialHours: 0,
    practicalHours: 0,
    type: "theory",
    electiveGroup: null
  },

  {
    name: "Digital Electronics and Microprocessor",
    year: "SE",
    semester: 3,
    lectureHours: 3,
    tutorialHours: 0,
    practicalHours: 0,
    type: "theory",
    electiveGroup: null
  },

  {
    name: "Lab & Programming, Data Structure and Algorithm using C",
    year: "SE",
    semester: 3,
    lectureHours: 0,
    tutorialHours: 0,
    practicalHours: 4,
    type: "lab",
    electiveGroup: null
  },

  {
    name: "Seminar-I",
    year: "SE",
    semester: 3,
    lectureHours: 0,
    tutorialHours: 0,
    practicalHours: 4,
    type: "seminar",
    electiveGroup: null
  },


  // ==========================================================
  // SEMESTER IV - SE
  // ==========================================================

  {
    name: "Python Programming",
    year: "SE",
    semester: 4,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: null
  },

  {
    name: "Database Management System",
    year: "SE",
    semester: 4,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: null
  },

  {
    name: "Basic Human Rights",
    year: "SE",
    semester: 4,
    lectureHours: 3,
    tutorialHours: 0,
    practicalHours: 0,
    type: "theory",
    electiveGroup: null
  },

  {
    name: "Probability Theory and Random Processes",
    year: "SE",
    semester: 4,
    lectureHours: 3,
    tutorialHours: 0,
    practicalHours: 0,
    type: "theory",
    electiveGroup: null
  },

  {
    name: "Professional Elective Course-I",
    year: "SE",
    semester: 4,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "PEC-I"
  },

  {
    name: "Python Programming Lab & Database Management System Lab",
    year: "SE",
    semester: 4,
    lectureHours: 0,
    tutorialHours: 0,
    practicalHours: 4,
    type: "lab",
    electiveGroup: null
  },

  {
    name: "Seminar-II",
    year: "SE",
    semester: 4,
    lectureHours: 0,
    tutorialHours: 0,
    practicalHours: 4,
    type: "seminar",
    electiveGroup: null
  },


  // PEC-I OPTIONS

  {
    name: "Microcontroller and Advanced Processor",
    year: "SE",
    semester: 4,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "PEC-I"
  },

  {
    name: "Data Analysis",
    year: "SE",
    semester: 4,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "PEC-I"
  },

  {
    name: "Electromagnetic Engineering and Wave Propagation",
    year: "SE",
    semester: 4,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "PEC-I"
  },

  {
    name: "Linux OS",
    year: "SE",
    semester: 4,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "PEC-I"
  },


  // ==========================================================
  // SEMESTER V - TE
  // ==========================================================

  {
    name: "Computer Networks",
    year: "TE",
    semester: 5,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: null
  },

  {
    name: "Digital Signal & Image Processing",
    year: "TE",
    semester: 5,
    lectureHours: 3,
    tutorialHours: 0,
    practicalHours: 0,
    type: "theory",
    electiveGroup: null
  },

  {
    name: "Professional Elective Course-II",
    year: "TE",
    semester: 5,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "PEC-II"
  },

  {
    name: "Open Elective Course-I",
    year: "TE",
    semester: 5,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "OEC-I"
  },

  {
    name: "Humanities/Social Sciences including Management Elective-I",
    year: "TE",
    semester: 5,
    lectureHours: 3,
    tutorialHours: 0,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "HSSMEC-I"
  },

  {
    name: "Computer Networks and Cloud Computing Lab and Competitive Programming Lab",
    year: "TE",
    semester: 5,
    lectureHours: 0,
    tutorialHours: 0,
    practicalHours: 4,
    type: "lab",
    electiveGroup: null
  },

  {
    name: "Mini Project-I",
    year: "TE",
    semester: 5,
    lectureHours: 0,
    tutorialHours: 0,
    practicalHours: 4,
    type: "project",
    electiveGroup: null
  },


  // PEC-II OPTIONS

  {
    name: "Sensors and Robotics Technology",
    year: "TE",
    semester: 5,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "PEC-II"
  },

  {
    name: "Data Warehouse & Data Mining",
    year: "TE",
    semester: 5,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "PEC-II"
  },

  {
    name: "Wireless & Mobile Computing",
    year: "TE",
    semester: 5,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "PEC-II"
  },

  {
    name: "Software Engineering",
    year: "TE",
    semester: 5,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "PEC-II"
  },


  // OEC-I OPTIONS

  {
    name: "Microelectronics Devices and Circuits",
    year: "TE",
    semester: 5,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "OEC-I"
  },

  {
    name: "Analog & Digital Communication",
    year: "TE",
    semester: 5,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "OEC-I"
  },

  {
    name: "Programming in JAVA",
    year: "TE",
    semester: 5,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "OEC-I"
  },

  {
    name: "Electrical Machines and Instrumentation",
    year: "TE",
    semester: 5,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "OEC-I"
  },


  // HSSMEC-I OPTIONS

  {
    name: "Economics and Management",
    year: "TE",
    semester: 5,
    lectureHours: 3,
    tutorialHours: 0,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "HSSMEC-I"
  },

  {
    name: "Business Communication",
    year: "TE",
    semester: 5,
    lectureHours: 3,
    tutorialHours: 0,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "HSSMEC-I"
  },


  // ==========================================================
  // SEMESTER VI - TE
  // ==========================================================

  {
    name: "Internet of Things",
    year: "TE",
    semester: 6,
    lectureHours: 3,
    tutorialHours: 0,
    practicalHours: 0,
    type: "theory",
    electiveGroup: null
  },

  {
    name: "Artificial Intelligence and Machine Learning",
    year: "TE",
    semester: 6,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: null
  },

  {
    name: "Professional Elective Course-III",
    year: "TE",
    semester: 6,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "PEC-III"
  },

  {
    name: "Open Elective Course-II",
    year: "TE",
    semester: 6,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "OEC-II"
  },

  {
    name: "Humanities/Social Sciences including Management Elective-II",
    year: "TE",
    semester: 6,
    lectureHours: 3,
    tutorialHours: 0,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "HSSMEC-II"
  },

  {
    name: "Internet of Things Lab and AI/ML Lab",
    year: "TE",
    semester: 6,
    lectureHours: 0,
    tutorialHours: 0,
    practicalHours: 4,
    type: "lab",
    electiveGroup: null
  },

  {
    name: "Mini Project-II",
    year: "TE",
    semester: 6,
    lectureHours: 0,
    tutorialHours: 0,
    practicalHours: 4,
    type: "project",
    electiveGroup: null
  },


  // PEC-III OPTIONS

  {
    name: "Industrial Automation and Control (PLC)",
    year: "TE",
    semester: 6,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "PEC-III"
  },

  {
    name: "Big Data Analytics",
    year: "TE",
    semester: 6,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "PEC-III"
  },

  {
    name: "Microwave and Optical Fibre Communication",
    year: "TE",
    semester: 6,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "PEC-III"
  },

  {
    name: "Software Testing",
    year: "TE",
    semester: 6,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "PEC-III"
  },


  // OEC-II OPTIONS

  {
    name: "VLSI Design",
    year: "TE",
    semester: 6,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "OEC-II"
  },

  {
    name: "Information Theory & Coding",
    year: "TE",
    semester: 6,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "OEC-II"
  },

  {
    name: "Android Programming",
    year: "TE",
    semester: 6,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "OEC-II"
  },

  {
    name: "Electrical Drives and Instrumentation",
    year: "TE",
    semester: 6,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "OEC-II"
  },


  // HSSMEC-II OPTIONS

  {
    name: "Development Engineering",
    year: "TE",
    semester: 6,
    lectureHours: 3,
    tutorialHours: 0,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "HSSMEC-II"
  },

  {
    name: "Employability and Skill Development",
    year: "TE",
    semester: 6,
    lectureHours: 3,
    tutorialHours: 0,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "HSSMEC-II"
  },

  {
    name: "Consumer Behaviour",
    year: "TE",
    semester: 6,
    lectureHours: 3,
    tutorialHours: 0,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "HSSMEC-II"
  },


  // ==========================================================
  // SEMESTER VII - BE
  // ==========================================================

  {
    name: "Industry 4.0 and Automation",
    year: "BE",
    semester: 7,
    lectureHours: 3,
    tutorialHours: 0,
    practicalHours: 0,
    type: "theory",
    electiveGroup: null
  },

  {
    name: "Deep Learning",
    year: "BE",
    semester: 7,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: null
  },

  {
    name: "DevOps (Development & Operations)",
    year: "BE",
    semester: 7,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: null
  },

  {
    name: "Professional Elective Course-IV",
    year: "BE",
    semester: 7,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "PEC-IV"
  },

  {
    name: "Open Elective Course-III",
    year: "BE",
    semester: 7,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "OEC-III"
  },

  {
    name: "Humanities/Social Sciences including Management Elective-II",
    year: "BE",
    semester: 7,
    lectureHours: 0,
    tutorialHours: 0,
    practicalHours: 4,
    type: "seminar",
    electiveGroup: "HSSMEC-II"
  },

  {
    name: "DevOps Lab and Deep Learning Lab",
    year: "BE",
    semester: 7,
    lectureHours: 0,
    tutorialHours: 0,
    practicalHours: 4,
    type: "lab",
    electiveGroup: null
  },

  {
    name: "Project Work",
    year: "BE",
    semester: 7,
    lectureHours: 0,
    tutorialHours: 0,
    practicalHours: 4,
    type: "project",
    electiveGroup: null
  },


  // PEC-IV OPTIONS

  {
    name: "Automotive Electronics",
    year: "BE",
    semester: 7,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "PEC-IV"
  },

  {
    name: "Consumer Electronics",
    year: "BE",
    semester: 7,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "PEC-IV"
  },

  {
    name: "Satellite & Radar Engineering",
    year: "BE",
    semester: 7,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "PEC-IV"
  },

  {
    name: "Web Development",
    year: "BE",
    semester: 7,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "PEC-IV"
  },

  {
    name: "Data Science",
    year: "BE",
    semester: 7,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "PEC-IV"
  },


  // OEC-III OPTIONS

  {
    name: "Nano Technology",
    year: "BE",
    semester: 7,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "OEC-III"
  },

  {
    name: "Cyber Security & Blockchain Technology",
    year: "BE",
    semester: 7,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "OEC-III"
  },

  {
    name: "IOS Programming",
    year: "BE",
    semester: 7,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "OEC-III"
  },

  {
    name: "Renewable Energy Sources",
    year: "BE",
    semester: 7,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "OEC-III"
  },

  {
    name: "Smart Grid Introduction and Application",
    year: "BE",
    semester: 7,
    lectureHours: 3,
    tutorialHours: 1,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "OEC-III"
  },


  // HSSMEC OPTIONS

  {
    name: "Foreign Language Studies",
    year: "BE",
    semester: 7,
    lectureHours: 3,
    tutorialHours: 0,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "HSSMEC-II"
  },

  {
    name: "Universal Human Values",
    year: "BE",
    semester: 7,
    lectureHours: 3,
    tutorialHours: 0,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "HSSMEC-II"
  },

  {
    name: "Intellectual Property Rights",
    year: "BE",
    semester: 7,
    lectureHours: 3,
    tutorialHours: 0,
    practicalHours: 0,
    type: "theory",
    electiveGroup: "HSSMEC-II"
  },


  // ==========================================================
  // SEMESTER VIII - BE
  // ==========================================================

  {
    name: "Project Work / Internship",
    year: "BE",
    semester: 8,
    lectureHours: 0,
    tutorialHours: 0,
    practicalHours: 24,
    type: "project",
    electiveGroup: null
  }

];


// ============================================================
// CREATE STABLE FIRESTORE ID
// ============================================================

function createSubjectId(subject) {

  return (
    `${subject.year}_${subject.semester}_` +
    subject.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .substring(0, 80)
  );

}


// ============================================================
// SEED BUILT-IN SUBJECTS
// ============================================================

async function seedBuiltInSubjects() {

  for (const subject of BUILT_IN_SUBJECTS) {

    const subjectId =
      createSubjectId(subject);

    const subjectRef =
      doc(
        db,
        "subjects",
        subjectId
      );

    await setDoc(
      subjectRef,
      {
        ...subject,

        code: "",

        weeklyHours:
          subject.lectureHours +
          subject.tutorialHours +
          subject.practicalHours,

        active: true,

        source:
          "built-in-course-structure",

        updatedAt:
          serverTimestamp()
      },
      {
        merge: true
      }
    );

  }

  console.log(
    "Built-in subject list loaded."
  );

}


// ============================================================
// INITIALISE PAGE
// ============================================================

async function initialisePage() {

  renderNavigation();

  await requireAuthenticatedUser();

  document
    .querySelector("#protectedContent")
    .removeAttribute("hidden");

  enableSignOut();

  setupEvents();

  // Automatically put built-in subjects into Firestore.
  await seedBuiltInSubjects();

  listenForSubjects();

}


// ============================================================
// EVENTS
// ============================================================

function setupEvents() {

  const addButton =
    document.querySelector(
      "#addSubjectButton"
    );

  if (addButton) {

    addButton.addEventListener(
      "click",
      () => openModal()
    );

  }


  const closeButton =
    document.querySelector(
      "#closeModalButton"
    );

  if (closeButton) {

    closeButton.addEventListener(
      "click",
      closeModal
    );

  }


  const cancelButton =
    document.querySelector(
      "#cancelButton"
    );

  if (cancelButton) {

    cancelButton.addEventListener(
      "click",
      closeModal
    );

  }


  const form =
    document.querySelector(
      "#subjectForm"
    );

  if (form) {

    form.addEventListener(
      "submit",
      saveSubject
    );

  }


  document
    .querySelector("#yearFilter")
    ?.addEventListener(
      "change",
      renderSubjects
    );


  document
    .querySelector("#semesterFilter")
    ?.addEventListener(
      "change",
      renderSubjects
    );


  document
    .querySelector("#typeFilter")
    ?.addEventListener(
      "change",
      renderSubjects
    );


  document
    .querySelector("#subjectsTableBody")
    ?.addEventListener(
      "click",
      handleTableAction
    );

}


// ============================================================
// LOAD SUBJECTS
// ============================================================

function listenForSubjects() {

  onSnapshot(
    subjectsCollection,

    snapshot => {

      subjects =
        snapshot.docs.map(item => ({
          id: item.id,
          ...item.data()
        }));

      renderSubjects();

      updateStatistics();

    },

    error => {

      console.error(
        "Error loading subjects:",
        error
      );

      const tbody =
        document.querySelector(
          "#subjectsTableBody"
        );

      if (tbody) {

        tbody.innerHTML = `
          <tr>
            <td
              colspan="11"
              class="empty-state"
            >
              Unable to load subjects.
            </td>
          </tr>
        `;

      }

    }
  );

}


// ============================================================
// OPEN MODAL
// ============================================================

function openModal(subject = null) {

  const modal =
    document.querySelector(
      "#subjectModal"
    );

  if (!modal) {
    return;
  }


  const form =
    document.querySelector(
      "#subjectForm"
    );


  editingSubjectId =
    subject?.id || null;


  form?.reset();


  document.querySelector(
    "#modalTitle"
  ).textContent =
    subject
      ? "Edit Subject"
      : "Add Subject";


  document.querySelector(
    "#subjectId"
  ).value =
    subject?.id || "";


  document.querySelector(
    "#subjectName"
  ).value =
    subject?.name || "";


  document.querySelector(
    "#subjectCode"
  ).value =
    subject?.code || "";


  document.querySelector(
    "#year"
  ).value =
    subject?.year || "";


  document.querySelector(
    "#semester"
  ).value =
    subject?.semester || "";


  document.querySelector(
    "#lectureHours"
  ).value =
    subject?.lectureHours ?? 0;


  document.querySelector(
    "#tutorialHours"
  ).value =
    subject?.tutorialHours ?? 0;


  document.querySelector(
    "#practicalHours"
  ).value =
    subject?.practicalHours ?? 0;


  document.querySelector(
    "#subjectType"
  ).value =
    subject?.type || "theory";


  document.querySelector(
    "#electiveGroup"
  ).value =
    subject?.electiveGroup || "";


  document.querySelector(
    "#active"
  ).value =
    subject?.active === false
      ? "false"
      : "true";


  document.querySelector(
    "#subjectMessage"
  ).textContent = "";


  modal.removeAttribute(
    "hidden"
  );

  modal.style.display =
    "flex";

}


// ============================================================
// CLOSE MODAL
// ============================================================

function closeModal() {

  const modal =
    document.querySelector(
      "#subjectModal"
    );

  if (!modal) {
    return;
  }


  modal.setAttribute(
    "hidden",
    ""
  );

  modal.style.display =
    "none";


  editingSubjectId =
    null;


  document
    .querySelector("#subjectForm")
    ?.reset();


  const message =
    document.querySelector(
      "#subjectMessage"
    );

  if (message) {
    message.textContent = "";
  }

}


// ============================================================
// SAVE SUBJECT
// ============================================================

async function saveSubject(event) {

  event.preventDefault();


  const button =
    document.querySelector(
      "#saveSubjectButton"
    );

  const message =
    document.querySelector(
      "#subjectMessage"
    );


  button.disabled = true;

  button.textContent =
    "Saving...";


  try {

    const name =
      document
        .querySelector("#subjectName")
        .value
        .trim();


    const code =
      document
        .querySelector("#subjectCode")
        .value
        .trim();


    const year =
      document
        .querySelector("#year")
        .value;


    const semester =
      Number(
        document
          .querySelector("#semester")
          .value
      );


    const lectureHours =
      Number(
        document
          .querySelector("#lectureHours")
          .value
      );


    const tutorialHours =
      Number(
        document
          .querySelector("#tutorialHours")
          .value
      );


    const practicalHours =
      Number(
        document
          .querySelector("#practicalHours")
          .value
      );


    const type =
      document
        .querySelector("#subjectType")
        .value;


    const electiveGroup =
      document
        .querySelector("#electiveGroup")
        .value;


    const active =
      document
        .querySelector("#active")
        .value === "true";


    // --------------------------------------------------------
    // VALIDATION
    // --------------------------------------------------------

    if (!name) {

      throw new Error(
        "Subject name is required."
      );

    }


    if (!year) {

      throw new Error(
        "Please select a year."
      );

    }


    if (!semester) {

      throw new Error(
        "Please select a semester."
      );

    }


    if (
      lectureHours < 0 ||
      tutorialHours < 0 ||
      practicalHours < 0
    ) {

      throw new Error(
        "L/T/P hours cannot be negative."
      );

    }


    if (
      lectureHours === 0 &&
      tutorialHours === 0 &&
      practicalHours === 0
    ) {

      throw new Error(
        "At least one L/T/P hour is required."
      );

    }


    // --------------------------------------------------------
    // SUBJECT DATA
    // --------------------------------------------------------

    const subjectData = {

      name,

      code,

      year,

      semester,

      lectureHours,

      tutorialHours,

      practicalHours,

      weeklyHours:
        lectureHours +
        tutorialHours +
        practicalHours,

      type,

      electiveGroup:
        electiveGroup || null,

      active,

      source:
        "manual",

      updatedAt:
        serverTimestamp()

    };


    // --------------------------------------------------------
    // UPDATE
    // --------------------------------------------------------

    if (editingSubjectId) {

      await updateDoc(
        doc(
          db,
          "subjects",
          editingSubjectId
        ),
        subjectData
      );


      showMessage(
        "Subject updated successfully.",
        "success"
      );

    }


    // --------------------------------------------------------
    // ADD
    // --------------------------------------------------------

    else {

      subjectData.createdAt =
        serverTimestamp();


      await addDoc(
        subjectsCollection,
        subjectData
      );


      showMessage(
        "Subject added successfully.",
        "success"
      );

    }


    setTimeout(
      closeModal,
      500
    );


  } catch (error) {

    console.error(
      "Subject save error:",
      error
    );


    showMessage(
      error.message ||
      "Unable to save subject.",
      "error"
    );


  } finally {

    button.disabled = false;

    button.textContent =
      "Save Subject";

  }

}


// ============================================================
// RENDER SUBJECTS
// ============================================================

function renderSubjects() {

  const tbody =
    document.querySelector(
      "#subjectsTableBody"
    );

  if (!tbody) {
    return;
  }


  const year =
    document.querySelector(
      "#yearFilter"
    )?.value || "all";


  const semester =
    document.querySelector(
      "#semesterFilter"
    )?.value || "all";


  const type =
    document.querySelector(
      "#typeFilter"
    )?.value || "all";


  const filtered =
    subjects.filter(subject => {

      if (
        year !== "all" &&
        subject.year !== year
      ) {

        return false;

      }


      if (
        semester !== "all" &&
        String(subject.semester) !== semester
      ) {

        return false;

      }


      if (
        type !== "all" &&
        subject.type !== type
      ) {

        return false;

      }


      return true;

    });


  if (filtered.length === 0) {

    tbody.innerHTML = `
      <tr>
        <td
          colspan="11"
          class="empty-state"
        >
          No subjects found.
        </td>
      </tr>
    `;

    return;

  }


  filtered.sort(
    (a, b) => {

      const semesterDifference =
        Number(a.semester || 0) -
        Number(b.semester || 0);


      if (
        semesterDifference !== 0
      ) {

        return semesterDifference;

      }


      return (
        a.name || ""
      ).localeCompare(
        b.name || ""
      );

    }
  );


  tbody.innerHTML =
    filtered
      .map(subject => {

        const elective =
          subject.electiveGroup ||
          "—";


        const status =
          subject.active === false
            ? "Inactive"
            : "Active";


        return `
          <tr>

            <td>
              <strong>
                ${escapeHtml(
                  subject.name || ""
                )}
              </strong>
            </td>

            <td>
              ${escapeHtml(
                subject.code || "—"
              )}
            </td>

            <td>
              ${escapeHtml(
                subject.year || "—"
              )}
            </td>

            <td>
              ${subject.semester || "—"}
            </td>

            <td>
              ${subject.lectureHours ?? 0}
            </td>

            <td>
              ${subject.tutorialHours ?? 0}
            </td>

            <td>
              ${subject.practicalHours ?? 0}
            </td>

            <td>
              ${formatType(
                subject.type
              )}
            </td>

            <td>
              ${escapeHtml(
                elective
              )}
            </td>

            <td>
              ${status}
            </td>

            <td>

              <button
                type="button"
                class="outline-button"
                data-action="edit"
                data-id="${subject.id}"
              >
                Edit
              </button>

              <button
                type="button"
                class="outline-button"
                data-action="delete"
                data-id="${subject.id}"
              >
                Delete
              </button>

            </td>

          </tr>
        `;

      })
      .join("");

}


// ============================================================
// TABLE ACTIONS
// ============================================================

function handleTableAction(event) {

  const button =
    event.target.closest(
      "button[data-action]"
    );


  if (!button) {
    return;
  }


  const subject =
    subjects.find(
      item =>
        item.id ===
        button.dataset.id
    );


  if (!subject) {
    return;
  }


  const action =
    button.dataset.action;


  if (action === "edit") {

    openModal(subject);

    return;

  }


  if (action === "delete") {

    deleteSubject(subject);

  }

}


// ============================================================
// DELETE SUBJECT
// ============================================================

async function deleteSubject(subject) {

  const confirmed =
    window.confirm(
      `Delete "${subject.name}"?`
    );


  if (!confirmed) {
    return;
  }


  try {

    await deleteDoc(
      doc(
        db,
        "subjects",
        subject.id
      )
    );


  } catch (error) {

    console.error(
      "Delete subject error:",
      error
    );


    alert(
      "Unable to delete subject."
    );

  }

}


// ============================================================
// STATISTICS
// ============================================================

function updateStatistics() {

  const total =
    subjects.length;


  const theory =
    subjects.filter(
      subject =>
        subject.type === "theory"
    ).length;


  const labs =
    subjects.filter(
      subject =>
        subject.type === "lab"
    ).length;


  const electives =
    subjects.filter(
      subject =>
        Boolean(
          subject.electiveGroup
        )
    ).length;


  const totalElement =
    document.querySelector(
      "#totalSubjects"
    );


  const theoryElement =
    document.querySelector(
      "#theorySubjects"
    );


  const labElement =
    document.querySelector(
      "#labSubjects"
    );


  const electiveElement =
    document.querySelector(
      "#electiveSubjects"
    );


  if (totalElement) {
    totalElement.textContent =
      total;
  }


  if (theoryElement) {
    theoryElement.textContent =
      theory;
  }


  if (labElement) {
    labElement.textContent =
      labs;
  }


  if (electiveElement) {
    electiveElement.textContent =
      electives;
  }

}


// ============================================================
// FORMAT TYPE
// ============================================================

function formatType(type) {

  const names = {

    theory: "Theory",

    lab: "Lab",

    seminar: "Seminar",

    project: "Project",

    audit: "Audit"

  };


  return (
    names[type] ||
    "—"
  );

}


// ============================================================
// MESSAGE
// ============================================================

function showMessage(
  message,
  type
) {

  const element =
    document.querySelector(
      "#subjectMessage"
    );


  if (!element) {
    return;
  }


  element.textContent =
    message;


  element.className =
    `form-message ${type}`;

}


// ============================================================
// HTML SECURITY
// ============================================================

function escapeHtml(value) {

  return String(value)

    .replaceAll(
      "&",
      "&amp;"
    )

    .replaceAll(
      "<",
      "&lt;"
    )

    .replaceAll(
      ">",
      "&gt;"
    )

    .replaceAll(
      '"',
      "&quot;"
    )

    .replaceAll(
      "'",
      "&#039;"
    );

}


// ============================================================
// START APPLICATION
// ============================================================

initialisePage()
  .catch(error => {

    if (
      error.message !==
      "Firebase has not been configured."
    ) {

      console.error(
        "Subjects page error:",
        error
      );

    }

  });