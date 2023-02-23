const logger = require('../logger')
const { formatDate } = require('../formatDate')

const https = require("https");
const cron = require("node-cron");

const { createCanvas } = require('canvas');
const lab = require('./lab.js');

const FIAT = ['dollar', 'euro', 'aud', 'ruble']

module.exports = function() {

  this.init = () => {
    
  }

  this.get = (fiat, sats) => {

    if (!FIAT.includes(fiat)) return

    if (isNaN(sats) || sats < 1 || sats > 10000) return

    return createImage(fiat, sats)
  }

  const PADDING = 10;
  const BORDER = 24;
  const RADIUS = 22;
  
  const settings = {
    columns: 10,
    grid: 10,
    dot: 6,
    dot_gap: 2,
    grid_gap: 4,
  }

  const FONT_SIZE = 14;

  const config = {
    text_bottom_left: 'We are all hodlonaut',
    text_bottom_right: 'CSW is a fraud',
  }

  function createImage(fiat, sats) {
    var [r, g, b] = lab.getRandomColor();
    
    var background = 0xFF000000 + (b << 16) + (g << 8) + r;
    var color = (r * 0.299 + g * 0.587 + b * 0.114) > 149 ? 0xFF000000 : 0xFFFFFFFF;
    
    var width = getWidth();
    var height = getHeight(Math.floor(sats));
  
    var WIDTH = width + PADDING + PADDING + BORDER + BORDER;
    var HEIGHT = height + PADDING + PADDING + BORDER + BORDER;
  
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');
    
    const imageData = ctx.getImageData(0, 0, WIDTH, HEIGHT);
    
    var buffer = new ArrayBuffer(imageData.data.length);
    var pixels = new Uint32Array(buffer);
  
    // Comment out for white background
    // pixels.fill(0);
  
    var ox = (WIDTH - width) >> 1;
    var oy = (HEIGHT - height) >> 1;
  
    drawBackground(pixels, background, WIDTH, width, height, ox, oy);
  
    drawDots(pixels, color, WIDTH, ox, oy, sats);
  
    imageData.data.set(new Uint8ClampedArray(buffer));
    ctx.putImageData(imageData, 0, 0);
    ctx.fillStyle = `#${(color & 0xFFFFFF).toString(16)}`;
    ctx.font = `${FONT_SIZE}px DejaVu Sans Mono`;
    ctx.imageSmoothingEnabled = false;
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${sats} sats per ${fiat}`, ox, oy - (BORDER >> 1));
    // if (config.text_top_right) {
    //   ctx.textAlign = 'right'
    //   ctx.textBaseline = 'middle'
    //   ctx.fillText(config.text_top_right, ox + width, oy - (BORDER >> 1));
    // }
    if (config.text_bottom_left) {
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(config.text_bottom_left, ox, oy + height + (BORDER >> 1));
    }
    if (config.text_bottom_right) {
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(config.text_bottom_right, ox + width, oy + height + (BORDER >> 1));
    }
    return canvas.toBuffer();
  }

  function getWidth() {
    return (settings.columns * 10 * settings.dot) + (settings.columns * 9 * settings.dot_gap) + ((settings.columns - 1) * settings.grid_gap);
  }

  function getHeight(sats) {
    var rows = Math.ceil(sats / (settings.columns * 100));
    return (rows * 10 * settings.dot) + (rows * 9 * settings.dot_gap) + ((rows - 1) * settings.grid_gap)
  }

  
  function drawBackground(pixels, color, WIDTH, width, height, ox, oy) {
    ox -= BORDER;
    oy -= BORDER;
    width += BORDER << 1;
    height += BORDER << 1;
    
    var circle = getCircle()
  
    var x = ox + ((oy + RADIUS) * WIDTH);
    for (var i = 0; i <= height - RADIUS - RADIUS; i++) {
      pixels.fill(color, x, x + width);
      x += WIDTH;
    }
    var x = ox + RADIUS + (oy * WIDTH);
    var x2 = (height - RADIUS - 1) * WIDTH;
    for (var i = 0; i <= RADIUS; i++) {
      var c1 = circle[RADIUS - i];
      pixels.fill(color, x - c1, x + width + c1 - RADIUS - RADIUS);
      var c2 = circle[i];
      pixels.fill(color, x + x2 - c2, x + x2 + width + c2 - RADIUS - RADIUS);
      x += WIDTH;
    }
  }
  
  function drawDots(pixels, color, WIDTH, ox ,oy, sats) {
    var block = (settings.dot * settings.columns) + (settings.dot_gap * (settings.columns - 1)) + settings.grid_gap
  
    var ax = 0, ay = 0, bx = 0, by = 0;
    
    for (var i = 0; i < Math.floor(sats); i++) {
  
      var x = ox + (ax * (settings.dot + settings.dot_gap)) + (bx * block);
      var y = oy + (ay * (settings.dot + settings.dot_gap)) + (by * block);
      
      dot(pixels, WIDTH, x, y, color);
      
      ax++;
      if (ax == settings.grid) {
        ax = 0;
        ay++;
      }
      
      if (ay == settings.grid) {
        bx++;
        ay = 0;
      }
      
      if (bx == settings.columns) {
        by++;
        bx = 0;
      }
    }
  }
  
  function getCircle() {
    var circle = new Array(RADIUS);
    circle[0] = RADIUS;
  
    var x = 0;
    var y = RADIUS;
    var d = 3 - (2 * RADIUS);
   
    while(x <= y) {
      if(d <= 0) {
        d = d + (4 * x) + 6;
      } else {
        d = d + (4 * x) - (4 * y) + 10;
        y--;
      }
      x++;
  
      circle[x] = y;
      circle[y] = x;
    }
  
    return circle;
  }
  
  function dot(pixels, WIDTH, x, y, color) {
    var p = (y * WIDTH) + x;
    for (var i = 0; i < settings.dot; i++) {
      pixels.fill(color, p, p + settings.dot);
      p += WIDTH;
    }
  }  
}
