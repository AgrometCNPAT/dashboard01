/* =========================================================
   particles3d.js
   Campo de partículas conectadas em 3D — abertura e panorama.
   Discreto, com rotação lenta e profundidade sutil.
   ========================================================= */

function createParticleNetwork3D(container, opts={}){
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 400;
  const count = opts.count || 90;
  const color = opts.color || 0x2E8B57;
  const linkColor = opts.linkColor || 0x1A5DA6;
  const radius = opts.radius || 6;
  const maxLinkDist = opts.maxLinkDist || 2.1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, width/height, 0.1, 100);
  camera.position.z = opts.cameraZ || 7.5;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  container.innerHTML = "";
  container.appendChild(renderer.domElement);

  const group = new THREE.Group();
  scene.add(group);

  // ---- Pontos ----
  const positions = new Float32Array(count*3);
  const velocities = [];
  for(let i=0;i<count;i++){
    const v = new THREE.Vector3(
      (Math.random()-0.5)*radius*2,
      (Math.random()-0.5)*radius*1.3,
      (Math.random()-0.5)*radius
    );
    positions[i*3]=v.x; positions[i*3+1]=v.y; positions[i*3+2]=v.z;
    velocities.push(new THREE.Vector3((Math.random()-0.5)*0.004,(Math.random()-0.5)*0.004,(Math.random()-0.5)*0.004));
  }
  const pointsGeo = new THREE.BufferGeometry();
  pointsGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const pointsMat = new THREE.PointsMaterial({ color, size: 0.07, transparent: true, opacity: 0.85 });
  const pointCloud = new THREE.Points(pointsGeo, pointsMat);
  group.add(pointCloud);

  // ---- Linhas entre pontos próximos (recalculadas periodicamente) ----
  const lineMat = new THREE.LineBasicMaterial({ color: linkColor, transparent: true, opacity: 0.18 });
  let lineSegments = new THREE.LineSegments(new THREE.BufferGeometry(), lineMat);
  group.add(lineSegments);

  function rebuildLinks(){
    const verts = [];
    const pos = pointsGeo.attributes.position.array;
    for(let i=0;i<count;i++){
      const xi=pos[i*3], yi=pos[i*3+1], zi=pos[i*3+2];
      for(let j=i+1;j<count;j++){
        const dx=xi-pos[j*3], dy=yi-pos[j*3+1], dz=zi-pos[j*3+2];
        const d = Math.sqrt(dx*dx+dy*dy+dz*dz);
        if(d < maxLinkDist){
          verts.push(xi,yi,zi, pos[j*3],pos[j*3+1],pos[j*3+2]);
        }
      }
    }
    lineSegments.geometry.dispose();
    lineSegments.geometry = new THREE.BufferGeometry();
    lineSegments.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
  }
  rebuildLinks();

  let raf, frame = 0;
  function animate(){
    frame++;
    const pos = pointsGeo.attributes.position.array;
    for(let i=0;i<count;i++){
      pos[i*3]   += velocities[i].x;
      pos[i*3+1] += velocities[i].y;
      pos[i*3+2] += velocities[i].z;
      if(Math.abs(pos[i*3]) > radius) velocities[i].x *= -1;
      if(Math.abs(pos[i*3+1]) > radius*0.7) velocities[i].y *= -1;
      if(Math.abs(pos[i*3+2]) > radius*0.5) velocities[i].z *= -1;
    }
    pointsGeo.attributes.position.needsUpdate = true;
    if(frame % 30 === 0) rebuildLinks();

    group.rotation.y += 0.0009;
    group.rotation.x = Math.sin(frame*0.0025) * 0.06;

    if(document.hidden){
      raf = requestAnimationFrame(animate);
      return;
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(animate);
  }
  animate();

  function handleResize(){
    const w = container.clientWidth, h = container.clientHeight;
    if(!w || !h) return;
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
    renderer.setSize(w,h);
  }
  window.addEventListener("resize", handleResize);

  function dispose(){
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", handleResize);
    pointsGeo.dispose();
    pointsMat.dispose();
    lineSegments.geometry.dispose();
    lineMat.dispose();
    renderer.dispose();
    if(container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
  }

  return { dispose };
}

window.CajuCarbo = window.CajuCarbo || {};
window.CajuCarbo.createParticleNetwork3D = createParticleNetwork3D;
