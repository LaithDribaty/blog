// ThreeJS and Third-party deps
import * as THREE from "three"
import { RectAreaLightHelper } from "three/examples/jsm/helpers/RectAreaLightHelper"
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib"
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass"
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TWEEN } from 'three/examples/jsm/libs/tween.module.min.js'

// Core boilerplate code deps
import { createCamera, createComposer, createRenderer, runApp } from "./core-utils"

// Other deps
import Tile from '../../assets/textures/checkertexture.png'

global.THREE = THREE

/**************************************************
 * 0. Tweakable parameters for the scene
 *************************************************/
const params = {
  // general scene params
  speed: 1,
  lightOneSwitch: true,
  lightTwoSwitch: true,
  lightThreeSwitch: true,
  // Bokeh pass properties
  focus: 0.0,
  aperture: 0,
  maxblur: 0.0
}


/**************************************************
 * 1. Initialize core threejs components
 *************************************************/
// Create the scene
let scene = new THREE.Scene()

// Create the renderer via 'createRenderer',
// 1st param receives additional WebGLRenderer properties
// 2nd param receives a custom callback to further configure the renderer
let renderer = createRenderer({ antialias: true }, (_renderer) => {
  // e.g. uncomment below if you want the output to be in sRGB color space
  _renderer.outputEncoding = THREE.sRGBEncoding
  _renderer.domElement.classList = "border border-0 rounded-right rounded-end-3"
})

// Create the camera
// Pass in fov, near, far and camera position respectively
let positions = [-5, 0 , 5];
let camera = createCamera(45, 1, 1000, { x: 0, y: 3, z: -8 })

// (Optional) Create the EffectComposer and passes for post-processing
// If you don't need post-processing, just comment/delete the following creation code, and skip passing any composer to 'runApp' at the bottom
let bokehPass = new BokehPass(scene, camera, {
  focus: 0.0,
  aperture: 0.0,
  maxblur: 0.0
})
// The RenderPass is already created in 'createComposer'
let composer = createComposer(renderer, scene, camera, (comp) => {
  comp.addPass(bokehPass)
})

/**************************************************
 * 2. Build your scene in this threejs app
 * This app object needs to consist of at least the async initScene() function (it is async so the animate function can wait for initScene() to finish before being called)
 * initScene() is called after a basic threejs environment has been set up, you can add objects/lighting to you scene in initScene()
 * if your app needs to animate things(i.e. not static), include a updateScene(interval, elapsed) function in the app as well
 *************************************************/
let app = {
  current: 1,
  async initScene() {

    // Scene setup taken from https://threejs.org/examples/#webgl_lights_rectarealight
    // Create rect area lights
    RectAreaLightUniformsLib.init()

    let rectLight1 = new THREE.RectAreaLight(0xff0000, 5, 4, 10)
    rectLight1.position.set(- 5, 5, 5)
    scene.add(rectLight1)

    let rectLight2 = new THREE.RectAreaLight(0x00ff00, 5, 4, 10)
    rectLight2.position.set(0, 5, 5)
    scene.add(rectLight2)

    let rectLight3 = new THREE.RectAreaLight(0x0000ff, 5, 4, 10)
    rectLight3.position.set(5, 5, 5)
    scene.add(rectLight3)

    this.lights = [rectLight1, rectLight2, rectLight3];
    for(let i=0;i<3;++i)
      scene.add(new RectAreaLightHelper(this.lights[i]))

    const la = this.lights[1].position.clone(); la.y -= 3;
    camera.lookAt(la);

    // Create the floor
    const geoFloor = new THREE.BoxGeometry(200, 0.1, 200)
    const matStdFloor = new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.5, metalness: 0 })
    const mshStdFloor = new THREE.Mesh(geoFloor, matStdFloor)
    // need await to make sure animation starts only after texture is loaded
    // this works because the animation code is 'then-chained' after initScene(), see core-utils.runApp
    await this.loadTexture(mshStdFloor)
    scene.add(mshStdFloor)

    const loader = new GLTFLoader();
    loader.load(
        // resource URL
        '/assets/glb/truffle_man.glb',
        // called when the resource is loaded
        ( gltf ) => {
            gltf.scene.scale.set(2,2,2)
            scene.add( gltf.scene );
            // animation of the characters
            this.mixer = new THREE.AnimationMixer( gltf.scene );
            
            // Play a specific animation
            const clip = THREE.AnimationClip.findByName( gltf.animations, 'Idle' );
            const action = this.mixer.clipAction( clip );
            action.play();
        },
        // called while loading is progressing
        function ( xhr ) {
            console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
        },
        // called when loading has errors
        function ( error ) {
            console.log( 'An error happened' );
        }
    )

    const matChanger = () => {
      bokehPass.uniforms['focus'].value = params.focus
      bokehPass.uniforms['aperture'].value = params.aperture * 0.00001
      bokehPass.uniforms['maxblur'].value = params.maxblur
    }

  },
  // load a texture for the floor
  // returns a promise so the caller can await on this function
  loadTexture(mshStdFloor) {
    return new Promise((resolve, reject) => {
      var loader = new THREE.TextureLoader()
      loader.load(Tile, function (texture) {
        texture.wrapS = THREE.RepeatWrapping
        texture.wrapT = THREE.RepeatWrapping
        texture.repeat.set(40, 40)
        mshStdFloor.material.map = texture
        resolve()
      }, undefined, function (error) {
        console.log(error)
        reject(error)
      })
    })
  },
  // @param we take the diff between the current and the second its either 1 or -1
  lookAt(diff) {
    let index = (this.current + diff + 3) % 3;
    this.current = index;

    // make the animation using tween animations library
    let from = camera.position.clone();
    let to = camera.position.clone().set(positions[this.current], from.y, from.z);
    new TWEEN.Tween(from)
        .to(to, 1000)
        .easing(TWEEN.Easing.Cubic.InOut)
        .onUpdate( function(object){
          camera.position.copy(object);
        }).start();
  },
  // @param {number} interval - time elapsed between 2 frames
  // @param {number} elapsed - total time elapsed since app start
  updateScene(interval, elapsed) {

    TWEEN.update();

    if(this.mixer)
      this.mixer.update( interval )
  }
}

/**************************************************
 * 3. Run the app
 * 'runApp' will do most of the boilerplate setup code for you:
 * e.g. HTML container, window resize listener, mouse move/touch listener for shader uniforms, THREE.Clock() for animation
 * Executing this line puts everything together and runs the app
 * ps. if you don't use custom shaders, pass undefined to the 'uniforms'(2nd-last) param
 * ps. if you don't use post-processing, pass undefined to the 'composer'(last) param
 *************************************************/
runApp(app, scene, renderer, camera, true, undefined, composer)