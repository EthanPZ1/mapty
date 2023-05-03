'use strict';

class Workout {
  date = new Date();
  id = `${Date.now()}`.slice(-10);

  constructor(coords, distance, duration, id) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    this.description = `${this.type[0].toUpperCase() + this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / this.duration;
    return this.speed;
  }
}

// Application Architecture
const body = document.querySelector('body');
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const editBtn = document.querySelector('.edit__button');
const renameTitle = document.querySelector('.rename__title');
const btnRename = document.querySelector('.button__rename');
const inputTitle = document.querySelector('#input__title');
const formChange = document.querySelector('.form__title-change');
const exitBtn = document.querySelector('.exit__button');
const modal = document.querySelector('.modal');
const btnDelAll = document.querySelector('.button__del__all');
const sortDropdown = document.querySelector('#sort__workouts');
const locFailedModal = document.querySelector('.location__fail');
const inputError = document.querySelector('.inputError');
const backdrop = document.querySelector('[data-backdrop]');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #updatedTitle;
  #marker;
  #allMarkers = [];
  #workout;
  #tempWorkout;

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._movetoPopup.bind(this));
    containerWorkouts.addEventListener('click', this._deleteWorkout.bind(this));
    containerWorkouts.addEventListener('click', this._showEditForm.bind(this));
    exitBtn.addEventListener('click', this._closeForm);
    containerWorkouts.addEventListener('click', this._rename.bind(this));
    btnRename.addEventListener('click', this._rename.bind(this));
    formChange.addEventListener('submit', e => e.preventDefault());
    btnDelAll.addEventListener('click', this._deleteAllWorkouts.bind(this));
    sortDropdown.addEventListener('change', this._sortWorkouts.bind(this));
    backdrop.addEventListener('click', this._closeModal.bind(this));
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(this._loadMap.bind(this), () =>
        locFailedModal.showModal()
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, 9);

    L.tileLayer(
      'https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }
    ).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    if (type === 'running') {
      const cadence = +inputCadence.value;
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return inputError.showModal();

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return inputError.showModal();
      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    this.#workouts.push(workout);

    // Display marker
    this._renderWorkoutMarker(workout);

    this._renderWorkout(workout);

    // Hide form and Clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();
  }

  _renderMarkerIcon() {
    const myIcon = L.icon({
      iconUrl: 'icon.png',
      iconSize: [50, 50],
      iconAnchor: [22, 94],
      popupAnchor: [-3, -76],
      shadowSize: [68, 95],
      shadowAnchor: [22, 94],
    });

    return myIcon;
  }

  _renderWorkoutMarker(workout) {
    this.#marker = L.marker(workout.coords, {
      icon: this._renderMarkerIcon(),
      id: workout.id,
    })
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();

    this.#allMarkers.push(this.#marker);
  }

  _renderWorkout(workout) {
    let html = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
          <h2 class="workout__title"><span class="title">${
            workout.description
          }</span> <span class="edit__button">Edit</span> <span class="delete__button">Delete</span></h2>
          <div class="workout__details">
            <span class="workout__icon">${
              workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
            }</span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">min</span>
        </div>
    `;

    if (workout.type === 'running')
      html += `
       <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>
        </li>
            `;

    if (workout.type === 'cycling')
      html += `
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed.toFixed(1)}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⛰</span>
            <span class="workout__value">${workout.elevationGain}</span>
            <span class="workout__unit">m</span>
          </div>
        </li>
            `;

    form.insertAdjacentHTML('afterend', html);
    this._checkExistingWorkouts();
  }

  _movetoPopup(e) {
    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  _checkExistingWorkouts() {
    const isExisting = Boolean(containerWorkouts.children[2]);

    btnDelAll.classList.toggle('invisible', !isExisting);
    sortDropdown.classList.toggle('invisible', !isExisting);
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));
    const workouts = this.#workouts;

    if (!data) return;

    data.forEach(function (data) {
      if (data.type === 'running') {
        const running = new Running(
          [...data.coords],
          data.distance,
          data.duration,
          data.cadence
        );
        running.id = data.id;
        running.description = data.description;
        workouts.push(running);
      }

      if (data.type === 'cycling') {
        const cycling = new Cycling(
          [...data.coords],
          data.distance,
          data.duration,
          data.elevationGain
        );
        cycling.id = data.id;
        cycling.description = data.description;
        workouts.push(cycling);
      }
    });

    workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  _deleteWorkout(e) {
    if (!e.target.closest('.delete__button')) return;

    const delBtn = e.target.closest('.delete__button');
    const closestWork = delBtn.closest('.workout');

    const objIndex = this.#workouts.findIndex(
      work => work.id === closestWork.dataset.id
    );

    const marker = this.#allMarkers.find(
      layer => layer.options.id === e.target.closest('.workout').dataset.id
    );

    this.#map.removeLayer(marker);

    this.#workouts.splice(objIndex, 1);

    this._setLocalStorage();

    closestWork.remove();

    this._checkExistingWorkouts();
  }

  _showEditForm(e) {
    if (!e.target.closest('.edit__button')) return;

    renameTitle.style.transform = 'translateY(5px)';
    this._modal();
  }

  _closeForm() {
    renameTitle.style.transform = 'translateY(-180px)';
    modal.style.display = 'none';
    inputTitle.value = '';
  }

  _modal() {
    modal.style.display = 'block';
  }

  _closeModal(e) {
    e.target.close();
  }

  _rename(e) {
    if (e.target.classList.contains('edit__button')) {
      this.#workout = e.target.closest('.workout');
      this.#tempWorkout = this.#workout;
    }

    if (e.target.classList.contains('button__rename') && inputTitle.value) {
      const title = [...this.#tempWorkout.children].find(child =>
        child.classList.contains('workout__title')
      ).firstElementChild;

      this.#updatedTitle = inputTitle.value;
      const obj = this.#workouts.find(
        work => work.id === this.#tempWorkout.dataset.id
      );

      const marker = this.#allMarkers.find(
        layer => layer.options.id === this.#workout.dataset.id
      );

      marker.setPopupContent(this.#updatedTitle);
      title.textContent = this.#updatedTitle;
      obj.description = this.#updatedTitle;

      localStorage.setItem('workouts', JSON.stringify(this.#workouts));

      this._closeForm();
    }
  }

  _sort(type) {
    if (type) {
      const arrValues = this.#workouts
        .slice()
        .sort((a, b) => a[type] - b[type]);
      this._deleteAllEl();
      arrValues.forEach(obj => this._renderWorkout(obj));
    }
  }

  _returnDefault() {
    this._deleteAllEl();
    this.#workouts.forEach(obj => this._renderWorkout(obj));
  }

  _sortWorkouts(e) {
    switch (e.target.value) {
      case 'distance':
        this._sort('distance');
        break;

      case 'duration':
        this._sort('duration');
        break;

      case 'default':
        this._returnDefault();
        break;
    }
  }

  _deleteAllEl() {
    [...containerWorkouts.children].forEach(work =>
      work.dataset.id ? work.remove() : null
    );
  }

  _deleteAllWorkouts() {
    this._deleteAllEl();
    this._checkExistingWorkouts();
    this.#workouts = [];

    this.#allMarkers.forEach(layer => this.#map.removeLayer(layer));
    localStorage.removeItem('workouts');
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}
const app = new App();
