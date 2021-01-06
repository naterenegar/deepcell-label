class ToggleEdit extends Action {
  constructor(model) {
    super();
    this.model = model;
  }

  do() {
    this.model.edit_mode = !this.model.edit_mode;
  }

  undo() {
    this.do()
  }

  redo() {
    this.do()
  }
}

class ToggleHighlight extends Action {
  constructor(model) {
    super();
    this.model = model;
  }

  do() {
    this.model.highlight = !this.model.highlight;
  }

  undo() {
    this.do()
  }

  redo() {
    this.do()
  }
}

/** Action to change the viewed frame. */
class ChangeFrame extends Action {
  constructor(model, frame) {
    super();
    this.model = model;
    this.oldValue = model.frame;
    this.newValue = frame.mod(model.numFrames);
  }

  do() {
    this.model.frame = this.newValue;
    if (this.model.action !== '') { this.model.clear() };
    this.model.setDisplay('frame', this.newValue);
  }


  undo() {
    this.model.frame = this.oldValue;
    if (this.model.action !== '') { this.model.clear() };
    this.model.setDisplay('frame', this.oldValue);
  }

  redo() {
    this.do();
  }
}

/** Action to change the viewed feature. */
class ChangeFeature extends Action {
  constructor(model, feature) {
    super();
    this.model = model;
    this.oldValue = model.feature;
    this.newValue = feature.mod(model.numFeatures);
  }

  do() {
    this.model.feature = this.newValue;
    this.model.clear();
    this.model.setDisplay('feature', this.newValue);
  }

  undo() {
    this.model.feature = this.oldValue;
    this.model.clear();
    this.model.setDisplay('feature', this.oldValue);
  }

  redo() {
    this.do();
  }
}

/** Action to change the viewed channel. */
class ChangeChannel extends Action {
  constructor(model, channel) {
    super();
    this.model = model;
    this.adjuster = model.adjuster;
    this.oldValue = model.channel;
    this.newValue = channel.mod(model.numChannels);
  }

  do() {
    const promise = this.model.setDisplay('channel', this.newValue);
    promise.done( () => {
      this.adjust(this.oldValue, this.newValue);
    });
    // render_info_display();
  }

  undo() {
    const promise = this.model.setDisplay('channel', this.oldValue);
    promise.done( () => {
      this.adjust(this.newValue, this.oldValue);
    });
  }

  redo() {
    this.do();
  }

  adjust(oldValue, newValue) {
    // save current display settings before changing
    this.adjuster.brightnessMap.set(oldValue, this.adjuster.brightness);
    this.adjuster.contrastMap.set(oldValue, this.adjuster.contrast);
    this.adjuster.invertMap.set(oldValue, this.adjuster.displayInvert);
    // get brightness/contrast vals for new channel
    this.adjuster.brightness = this.adjuster.brightnessMap.get(newValue);
    this.adjuster.contrast = this.adjuster.contrastMap.get(newValue);
    this.adjuster.displayInvert = this.adjuster.invertMap.get(newValue);

    this.model.clear();
    this.model.channel = newValue;
  }
}

class BackendAction extends Action {

  constructor(model) {
    super();
    this.model = model;
    this.action = model.action;
    this.info = model.info;
    this.projectID = model.projectID;
  }

  do() {
    const promise = $.ajax({
      type: 'POST',
      url: `${document.location.origin}/api/edit/${this.projectID}/${this.action}`,
      data: this.info,
      async: false
    });
    promise.done(this.model.handlePayload.bind(this.model));
  }

  undo() {
    const promise = $.ajax({
      type: 'POST',
      url: `${document.location.origin}/api/undo/${this.projectID}`,
      async: false
    })
    promise.done(this.model.handlePayload.bind(this.model));
  }

  redo() {
    const promise = $.ajax({
      type: 'POST',
      url: `${document.location.origin}/api/redo/${this.projectID}`,
      async: false
    })
    promise.done(this.model.handlePayload.bind(this.model));
  }
}

// actions on CanvasState

class Pan extends Action {
  // Implements command pattern for an undoable pan
  constructor(model, dx, dy) {
    super();
    this.canvas = model.canvas;
    // previous canvas position
    this.oldSx = this.canvas.sx;
    this.oldSy = this.canvas.sy;
    // change in canvas position
    this.dx = -dx;
    this.dy = -dy;
    // new canvas position (undefined until do)
    this.newSx;
    this.newSy;
  }

  do() {
    this.canvas.sx = this.canvas.sx + this.dx;
    this.canvas.sy = this.canvas.sy + this.dy;
    this.newSx = this.canvas.sx;
    this.newSy = this.canvas.sy;
  }

  redo() {
    this.canvas.sx = this.newSx;
    this.canvas.sy = this.newSy;
  }

  undo() {
    this.canvas.sx = this.oldSx;
    this.canvas.sy = this.oldSy;
  }
}

class Zoom extends Action {
  constructor(controller, model, dZoom) {
    super();
    let canvas = model.canvas;
    // Calculate how much canvas zooms
    const zoom = Math.max(canvas.zoom - 10 * dZoom, canvas.zoomLimit);

    // Calculate how canvas needs to pan after zooming
    const newHeight = canvas.height * 100 / zoom;
    const newWidth = canvas.width * 100 / zoom;
    const oldHeight = canvas.sHeight;
    const oldWidth = canvas.sWidth;
    const propX = canvas.canvasPosX / canvas.scaledWidth;
    const propY = canvas.canvasPosY / canvas.scaledHeight;
    this.dx = propX * (newWidth - oldWidth);
    this.dy = propY * (newHeight - oldHeight);

    this.model = model;
    this.canvas = canvas;
    this.controller = controller;
    this.oldZoom = canvas.zoom;
    this.newZoom = zoom;
  }

  do() {
    // Zoom then pan
    this.setZoom(this.newZoom);
    let pan = new Pan(this.model, this.dx, this.dy);
    this.controller.history.addAction(pan);
    // TODO: check if this is in the right place(s)
    this.model.updateMousePos(this.canvas.rawX, this.canvas.rawY);
  }

  redo() {
    this.setZoom(this.newZoom);
  }

  undo() {
    this.setZoom(this.oldZoom);
  }

  setZoom(zoom) {
    const newHeight = this.canvas.height * 100 / zoom;
    const newWidth = this.canvas.width * 100 / zoom;
    this.canvas.zoom = zoom;
    this.canvas.sHeight = newHeight;
    this.canvas.sWidth = newWidth;
  }
}

// actions on ImageAdjuster

class ChangeContrast extends Action {
  constructor(model, change) {
    super();
    let adjuster = model.adjuster;
    this.oldValue = adjuster.contrast;

    const modContrast = -Math.sign(change) * 4;
    // stop if fully desaturated
    let newContrast = Math.max(adjuster.contrast + modContrast, adjuster.minContrast);
    // stop at 8x contrast
    newContrast = Math.min(newContrast, adjuster.maxContrast);
    this.newValue = newContrast;
    this.adjuster = adjuster;
  }

  do() { this.setContrast(this.newValue); }

  undo() { this.setContrast(this.oldValue); }

  redo() { this.do(); }

  setContrast(contrast) {
    this.adjuster.rawLoaded = false;
    this.adjuster.contrast = contrast;
    this.adjuster.contrastRaw();
  }
}

class ChangeBrightness extends Action {
  constructor(model, change) {
    super();
    let adjuster = model.adjuster;
    const modBrightness = -Math.sign(change);
    // limit how dim image can go
    let newBrightness = Math.max(adjuster.brightness + modBrightness, adjuster.minBrightness);
    // limit how bright image can go
    newBrightness = Math.min(newBrightness, adjuster.maxBrightness);
    this.oldValue = adjuster.brightness;
    this.newValue = newBrightness;
    this.adjuster = adjuster;
  }

  do() { this.setBrightness(this.newValue); }

  undo() { this.setBrightness(this.oldValue); }

  redo() { this.do(); }

  setBrightness(brightness) {
    this.adjuster.rawLoaded = false;
    this.adjuster.brightness = brightness;
    this.adjuster.contrastRaw();
  }
}

class ResetBrightnessContrast extends Action {
  constructor(model) {
    super();
    this.adjuster = model.adjuster;
    this.brightness = model.adjuster.brightness;
    this.contrast = model.adjuster.contrast;
  }

  do() {
    this.adjuster.brightness = 0;
    this.adjuster.contrast = 0;
    this.adjuster.rawLoaded = false;
    this.adjuster.contrastRaw();
  }

  undo() {
    this.adjuster.brightness = this.brightness;
    this.adjuster.contrast = this.contrast;
    this.adjuster.rawLoaded = false;
    this.adjuster.contrastRaw();
  }

  redo() { this.do(); }
}

class ToggleInvert extends Action {
  constructor(model) {
    super();
    this.adjuster = model.adjuster;
  }

  do() {
    this.adjuster.displayInvert = !this.adjuster.displayInvert;
    this.adjuster.preCompRawAdjust();
  }

  undo() { this.do(); }

  redo() { this.do(); }
}
