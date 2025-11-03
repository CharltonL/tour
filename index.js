/*
 * Copyright 2016 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

// FILE UPDATED - Version 2024-10-31
console.log('=== CUSTOM INDEX.JS LOADED - VIEW PRESERVATION ENABLED ===');

(function() {
  var Marzipano = window.Marzipano;
  var bowser = window.bowser;
  var screenfull = window.screenfull;
  var data = window.APP_DATA;

  // Grab elements from DOM.
  var panoElement = document.querySelector('#pano');
  var sceneNameElement = document.querySelector('#titleBar .sceneName');
  var sceneListElement = document.querySelector('#sceneList');
  var sceneElements = document.querySelectorAll('#sceneList .scene');
  var sceneListToggleElement = document.querySelector('#sceneListToggle');
  var autorotateToggleElement = document.querySelector('#autorotateToggle');
  var fullscreenToggleElement = document.querySelector('#fullscreenToggle');

  // Detect desktop or mobile mode.
  if (window.matchMedia) {
    var setMode = function() {
      if (mql.matches) {
        document.body.classList.remove('desktop');
        document.body.classList.add('mobile');
      } else {
        document.body.classList.remove('mobile');
        document.body.classList.add('desktop');
      }
    };
    var mql = matchMedia("(max-width: 500px), (max-height: 500px)");
    setMode();
    mql.addListener(setMode);
  } else {
    document.body.classList.add('desktop');
  }

  // Detect whether we are on a touch device.
  document.body.classList.add('no-touch');
  window.addEventListener('touchstart', function() {
    document.body.classList.remove('no-touch');
    document.body.classList.add('touch');
  });

  // Use tooltip fallback mode on IE < 11.
  if (bowser.msie && parseFloat(bowser.version) < 11) {
    document.body.classList.add('tooltip-fallback');
  }

  // Viewer options.
  var viewerOpts = {
    controls: {
      mouseViewMode: data.settings.mouseViewMode
    }
  };

  // Initialize viewer.
  var viewer = new Marzipano.Viewer(panoElement, viewerOpts);

  // Create scenes.
  var scenes = data.scenes.map(function(data) {
    var urlPrefix = "tiles";
    var source = Marzipano.ImageUrlSource.fromString(
      urlPrefix + "/" + data.id + "/{z}/{f}/{y}/{x}.jpg",
      { cubeMapPreviewUrl: urlPrefix + "/" + data.id + "/preview.jpg" });
    var geometry = new Marzipano.CubeGeometry(data.levels);

    var limiter = Marzipano.RectilinearView.limit.traditional(data.faceSize, 100*Math.PI/180, 120*Math.PI/180);
    var view = new Marzipano.RectilinearView(data.initialViewParameters, limiter);

    var scene = viewer.createScene({
      source: source,
      geometry: geometry,
      view: view,
      pinFirstLevel: true
    });

    // Create link hotspots.
    data.linkHotspots.forEach(function(hotspot) {
      var element = createLinkHotspotElement(hotspot);
      scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    });

    // Create info hotspots.
    data.infoHotspots.forEach(function(hotspot) {
      var element = createInfoHotspotElement(hotspot);
      scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    });

    return {
      data: data,
      scene: scene,
      view: view
    };
  });

  // Set up autorotate, if enabled.
  var autorotate = Marzipano.autorotate({
    yawSpeed: 0.03,
    targetPitch: 0,
    targetFov: Math.PI/2
  });
  if (data.settings.autorotateEnabled) {
    autorotateToggleElement.classList.add('enabled');
  }

  // Set handler for autorotate toggle.
  autorotateToggleElement.addEventListener('click', toggleAutorotate);

  // Set up fullscreen mode, if supported.
  if (screenfull.enabled && data.settings.fullscreenButton) {
    document.body.classList.add('fullscreen-enabled');
    fullscreenToggleElement.addEventListener('click', function() {
      screenfull.toggle();
    });
    screenfull.on('change', function() {
      if (screenfull.isFullscreen) {
        fullscreenToggleElement.classList.add('enabled');
      } else {
        fullscreenToggleElement.classList.remove('enabled');
      }
    });
  } else {
    document.body.classList.add('fullscreen-disabled');
  }

  // Set handler for scene list toggle.
  sceneListToggleElement.addEventListener('click', toggleSceneList);

  // Start with the scene list open on desktop.
  if (!document.body.classList.contains('mobile')) {
    showSceneList();
  }

  // Set handler for scene switch.
  scenes.forEach(function(scene) {
    var el = document.querySelector('#sceneList .scene[data-id="' + scene.data.id + '"]');
    el.addEventListener('click', function() {
      switchScene(scene);
      // On mobile, hide scene list after selecting a scene.
      if (document.body.classList.contains('mobile')) {
        hideSceneList();
      }
    });
  });

  // DOM elements for view controls.
  var viewUpElement = document.querySelector('#viewUp');
  var viewDownElement = document.querySelector('#viewDown');
  var viewLeftElement = document.querySelector('#viewLeft');
  var viewRightElement = document.querySelector('#viewRight');
  var viewInElement = document.querySelector('#viewIn');
  var viewOutElement = document.querySelector('#viewOut');

  // Dynamic parameters for controls.
  var velocity = 0.7;
  var friction = 3;

  // Associate view controls with elements.
  var controls = viewer.controls();
  controls.registerMethod('upElement',    new Marzipano.ElementPressControlMethod(viewUpElement,     'y', -velocity, friction), true);
  controls.registerMethod('downElement',  new Marzipano.ElementPressControlMethod(viewDownElement,   'y',  velocity, friction), true);
  controls.registerMethod('leftElement',  new Marzipano.ElementPressControlMethod(viewLeftElement,   'x', -velocity, friction), true);
  controls.registerMethod('rightElement', new Marzipano.ElementPressControlMethod(viewRightElement,  'x',  velocity, friction), true);
  controls.registerMethod('inElement',    new Marzipano.ElementPressControlMethod(viewInElement,  'zoom', -velocity, friction), true);
  controls.registerMethod('outElement',   new Marzipano.ElementPressControlMethod(viewOutElement, 'zoom',  velocity, friction), true);

  function sanitize(s) {
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;');
  }

  function switchScene(scene, preserveView) {
    console.log('switchScene called, preserveView=' + preserveView);
    
    var savedView = null;
    if (preserveView) {
      savedView = viewer.view().parameters();
      console.log('Saving current view:', savedView.yaw, savedView.pitch);
    }
    
    stopAutorotate();
    scene.view.setParameters(scene.data.initialViewParameters);
    scene.scene.switchTo();
    
    if (preserveView && savedView) {
      console.log('Applying saved view to new scene');
      scene.view.setParameters({
        yaw: savedView.yaw,
        pitch: savedView.pitch,
        fov: savedView.fov
      });
    }
    
    startAutorotate();
    updateSceneName(scene);
    updateSceneList(scene);
  }

  function updateSceneName(scene) {
    sceneNameElement.innerHTML = sanitize(scene.data.name);
  }

  function updateSceneList(scene) {
    for (var i = 0; i < sceneElements.length; i++) {
      var el = sceneElements[i];
      if (el.getAttribute('data-id') === scene.data.id) {
        el.classList.add('current');
      } else {
        el.classList.remove('current');
      }
    }
  }

  function showSceneList() {
    sceneListElement.classList.add('enabled');
    sceneListToggleElement.classList.add('enabled');
  }

  function hideSceneList() {
    sceneListElement.classList.remove('enabled');
    sceneListToggleElement.classList.remove('enabled');
  }

  function toggleSceneList() {
    sceneListElement.classList.toggle('enabled');
    sceneListToggleElement.classList.toggle('enabled');
  }

  function startAutorotate() {
    if (!autorotateToggleElement.classList.contains('enabled')) {
      return;
    }
    viewer.startMovement(autorotate);
    viewer.setIdleMovement(3000, autorotate);
  }

  function stopAutorotate() {
    viewer.stopMovement();
    viewer.setIdleMovement(Infinity);
  }

  function toggleAutorotate() {
    if (autorotateToggleElement.classList.contains('enabled')) {
      autorotateToggleElement.classList.remove('enabled');
      stopAutorotate();
    } else {
      autorotateToggleElement.classList.add('enabled');
      startAutorotate();
    }
  }

  function createLinkHotspotElement(hotspot) {

    // Create wrapper element to hold icon and tooltip.
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot');
    wrapper.classList.add('link-hotspot');

    // Create image element.
    var icon = document.createElement('img');
    icon.src = 'img/link.png';
    icon.classList.add('link-hotspot-icon');

    // Set rotation transform.
    var transformProperties = [ '-ms-transform', '-webkit-transform', 'transform' ];
    for (var i = 0; i < transformProperties.length; i++) {
      var property = transformProperties[i];
      icon.style[property] = 'rotate(' + hotspot.rotation + 'rad)';
    }

    // Add click event handler.
    wrapper.addEventListener('click', function() {
      console.log('Link hotspot clicked!');
      switchScene(findSceneById(hotspot.target), true);
    });

    // Prevent touch and scroll events from reaching the parent element.
    // This prevents the view control logic from interfering with the hotspot.
    stopTouchAndScrollEventPropagation(wrapper);

    // Create tooltip element.
    var tooltip = document.createElement('div');
    tooltip.classList.add('hotspot-tooltip');
    tooltip.classList.add('link-hotspot-tooltip');
    tooltip.innerHTML = findSceneDataById(hotspot.target).name;

    wrapper.appendChild(icon);
    wrapper.appendChild(tooltip);

    return wrapper;
  }

  function createInfoHotspotElement(hotspot) {

    // Create wrapper element to hold icon and tooltip.
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot');
    wrapper.classList.add('info-hotspot');

    // Create hotspot/tooltip header.
    var header = document.createElement('div');
    header.classList.add('info-hotspot-header');

    // Create image element.
    var iconWrapper = document.createElement('div');
    iconWrapper.classList.add('info-hotspot-icon-wrapper');
    var icon = document.createElement('img');
    icon.src = 'img/info.png';
    icon.classList.add('info-hotspot-icon');
    iconWrapper.appendChild(icon);

    // Create title element.
    var titleWrapper = document.createElement('div');
    titleWrapper.classList.add('info-hotspot-title-wrapper');
    var title = document.createElement('div');
    title.classList.add('info-hotspot-title');
    title.innerHTML = hotspot.title;
    titleWrapper.appendChild(title);

    // Create close element.
    var closeWrapper = document.createElement('div');
    closeWrapper.classList.add('info-hotspot-close-wrapper');
    var closeIcon = document.createElement('img');
    closeIcon.src = 'img/close.png';
    closeIcon.classList.add('info-hotspot-close-icon');
    closeWrapper.appendChild(closeIcon);

    // Construct header element.
    header.appendChild(iconWrapper);
    header.appendChild(titleWrapper);
    header.appendChild(closeWrapper);

    // Create text/content element with carousel support
    var text = document.createElement('div');
    text.classList.add('info-hotspot-text');
    
    // Check if hotspot has images array for carousel
    if (hotspot.images && Array.isArray(hotspot.images) && hotspot.images.length > 0) {
      // Create carousel
      var carousel = document.createElement('div');
      carousel.classList.add('carousel-container');
      carousel.style.cssText = 'position: relative; width: 100%; max-width: 800px; margin: 0 auto;';
      
      // Create image container
      var imageContainer = document.createElement('div');
      imageContainer.classList.add('carousel-images');
      imageContainer.style.cssText = 'position: relative; width: 100%; overflow: hidden;';
      
      // Add all images
      hotspot.images.forEach(function(imgSrc, index) {
        var img = document.createElement('img');
        img.src = imgSrc;
        img.classList.add('carousel-image');
        img.style.cssText = 'width: 100%; height: auto; display: ' + (index === 0 ? 'block' : 'none') + '; border-radius: 8px;';
        img.setAttribute('data-index', index);
        imageContainer.appendChild(img);
      });
      
      carousel.appendChild(imageContainer);
      
      // Add navigation buttons if more than one image
      if (hotspot.images.length > 1) {
        var prevBtn = document.createElement('button');
        prevBtn.innerHTML = '‹';
        prevBtn.classList.add('carousel-btn', 'carousel-prev');
        prevBtn.style.cssText = 'position: absolute; left: 10px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.7); color: white; border: none; font-size: 32px; padding: 10px 15px; cursor: pointer; border-radius: 4px; z-index: 10;';
        
        var nextBtn = document.createElement('button');
        nextBtn.innerHTML = '›';
        nextBtn.classList.add('carousel-btn', 'carousel-next');
        nextBtn.style.cssText = 'position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.7); color: white; border: none; font-size: 32px; padding: 10px 15px; cursor: pointer; border-radius: 4px; z-index: 10;';
        
        // Add counter
        var counter = document.createElement('div');
        counter.classList.add('carousel-counter');
        counter.style.cssText = 'text-align: center; margin-top: 10px; color: #fff; font-size: 14px;';
        counter.innerHTML = '1 / ' + hotspot.images.length;
        
        var currentIndex = 0;
        
        function showImage(index) {
          var images = imageContainer.querySelectorAll('.carousel-image');
          images.forEach(function(img, i) {
            img.style.display = i === index ? 'block' : 'none';
          });
          counter.innerHTML = (index + 1) + ' / ' + hotspot.images.length;
          currentIndex = index;
        }
        
        prevBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          var newIndex = currentIndex > 0 ? currentIndex - 1 : hotspot.images.length - 1;
          showImage(newIndex);
        });
        
        nextBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          var newIndex = currentIndex < hotspot.images.length - 1 ? currentIndex + 1 : 0;
          showImage(newIndex);
        });
        
        carousel.appendChild(prevBtn);
        carousel.appendChild(nextBtn);
        carousel.appendChild(counter);
      }
      
      text.appendChild(carousel);
      
      // Add description if provided
      if (hotspot.text) {
        var description = document.createElement('p');
        description.innerHTML = hotspot.text;
        description.style.cssText = 'margin-top: 15px; color: #fff;';
        text.appendChild(description);
      }
    } else {
      // No carousel, use original text/HTML
      text.innerHTML = hotspot.text;
    }

    // Place header and text into wrapper element.
    wrapper.appendChild(header);
    wrapper.appendChild(text);
    
    // Add resize indicator to the text element (so it stays within the background)
    var resizeIndicator = document.createElement('div');
    resizeIndicator.classList.add('resize-indicator');
    resizeIndicator.innerHTML = '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M15 11L11 15M15 6L6 15M15 1L1 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '</svg>';
    text.appendChild(resizeIndicator);

    // Create a modal for mobile (not used on desktop)
    var modal = document.createElement('div');
    modal.classList.add('info-hotspot-modal');
    
    // Clone the content for mobile modal
    var modalHeader = header.cloneNode(true);
    var modalText = text.cloneNode(true);
    modal.appendChild(modalHeader);
    modal.appendChild(modalText);
    
    // Re-setup carousel in modal if it exists
    if (hotspot.images && Array.isArray(hotspot.images) && hotspot.images.length > 1) {
      var modalPrevBtn = modal.querySelector('.carousel-prev');
      var modalNextBtn = modal.querySelector('.carousel-next');
      var modalImageContainer = modal.querySelector('.carousel-images');
      var modalCounter = modal.querySelector('.carousel-counter');
      var modalCurrentIndex = 0;
      
      function modalShowImage(index) {
        var images = modalImageContainer.querySelectorAll('.carousel-image');
        images.forEach(function(img, i) {
          img.style.display = i === index ? 'block' : 'none';
        });
        modalCounter.innerHTML = (index + 1) + ' / ' + hotspot.images.length;
        modalCurrentIndex = index;
      }
      
      modalPrevBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        var newIndex = modalCurrentIndex > 0 ? modalCurrentIndex - 1 : hotspot.images.length - 1;
        modalShowImage(newIndex);
      });
      
      modalNextBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        var newIndex = modalCurrentIndex < hotspot.images.length - 1 ? modalCurrentIndex + 1 : 0;
        modalShowImage(newIndex);
      });
    }
    
    document.body.appendChild(modal);

    var toggle = function() {
      var isVisible = wrapper.classList.contains('visible');
      
      wrapper.classList.toggle('visible');
      modal.classList.toggle('visible');
      
      // If closing (was visible), reset the wrapper size
      if (isVisible) {
        wrapper.style.width = '';
        wrapper.style.height = '';
      }
    };

    // Show content when hotspot is clicked.
    wrapper.querySelector('.info-hotspot-header').addEventListener('click', toggle);

    // Hide content when close icon is clicked.
    modal.querySelector('.info-hotspot-close-wrapper').addEventListener('click', toggle);

    // Prevent touch and scroll events from reaching the parent element.
    // This prevents the view control logic from interfering with the hotspot.
    stopTouchAndScrollEventPropagation(wrapper);

    return wrapper;
  }

  // Prevent touch and scroll events from reaching the parent element.
  function stopTouchAndScrollEventPropagation(element, eventList) {
    var isDraggingInside = false;
    
    // Always block these events
    var alwaysBlockEvents = [ 'touchstart', 'touchmove', 'touchend', 'touchcancel',
                              'wheel', 'mousewheel', 'click', 'drag', 'dragstart' ];
    
    for (var i = 0; i < alwaysBlockEvents.length; i++) {
      element.addEventListener(alwaysBlockEvents[i], function(event) {
        event.stopPropagation();
      });
    }
    
    // Track mousedown inside the modal
    element.addEventListener('mousedown', function(event) {
      isDraggingInside = true;
      event.stopPropagation();
    });
    
    element.addEventListener('pointerdown', function(event) {
      isDraggingInside = true;
      event.stopPropagation();
    });
    
    // Only block mousemove/mouseup if drag started inside
    element.addEventListener('mousemove', function(event) {
      if (isDraggingInside) {
        event.stopPropagation();
      }
    });
    
    element.addEventListener('mouseup', function(event) {
      if (isDraggingInside) {
        event.stopPropagation();
      }
      isDraggingInside = false;
    });
    
    element.addEventListener('pointermove', function(event) {
      if (isDraggingInside) {
        event.stopPropagation();
      }
    });
    
    element.addEventListener('pointerup', function(event) {
      if (isDraggingInside) {
        event.stopPropagation();
      }
      isDraggingInside = false;
    });
    
    // Reset flag if mouse leaves during drag (safety)
    element.addEventListener('mouseleave', function(event) {
      isDraggingInside = false;
    });
  }

  function findSceneById(id) {
    for (var i = 0; i < scenes.length; i++) {
      if (scenes[i].data.id === id) {
        return scenes[i];
      }
    }
    return null;
  }

  function findSceneDataById(id) {
    for (var i = 0; i < data.scenes.length; i++) {
      if (data.scenes[i].id === id) {
        return data.scenes[i];
      }
    }
    return null;
  }

  // Display the initial scene.
  switchScene(scenes[0]);

  // ============================================
  // COORDINATE LOGGER - Click anywhere to get yaw/pitch for hotspots
  // ============================================
  panoElement.addEventListener('click', function(event) {
    var view = viewer.view();
    var coords = view.screenToCoordinates({x: event.clientX, y: event.clientY});
    if (coords) {
      console.log('=====================================');
      console.log('  "yaw": ' + coords.yaw.toFixed(4) + ',' +' "pitch": ' + coords.pitch.toFixed(4));
    }
  });

})();