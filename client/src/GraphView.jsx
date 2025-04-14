import React, { useEffect, useRef, useMemo } from "react";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";
import SpriteText from "three-spritetext";

const GraphView = ({ data, onNodeClick }) => {
  const fgRef = useRef();
  const containerRef = useRef();

  // Define a rich color palette with better contrast and visual appeal
  const colorPalette = useMemo(
    () => ({
      user: "#8A2BE2", // Deeper purple
      userMessage: "#FF4757", // Vibrant red
      aiMessage: "#00D1B2", // Turquoise teal
      topic: "#FFF3B0", // Soft yellow
      default: "#9BAEC8",
    }),
    []
  );

  useEffect(() => {
    if (fgRef.current && data) {
      // Configure the graph physics
      fgRef.current.d3Force("charge").strength(-120);
      fgRef.current.d3Force("link").distance(120);

      // Add camera controls for a better viewing experience
      const camera = fgRef.current.camera();
      camera.far = 10000;
      camera.updateProjectionMatrix();

      // Initial camera position for better viewing angle
      fgRef.current.cameraPosition({ z: 300 });
    }
  }, [data]);

  // Handle window resize to maintain proper dimensions
  useEffect(() => {
    const handleResize = () => {
      if (fgRef.current && containerRef.current) {
        fgRef.current.width(containerRef.current.clientWidth);
      }
    };

    window.addEventListener("resize", handleResize);
    // Initial size setup
    setTimeout(handleResize, 0);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!data)
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
        <div className="text-lg font-medium text-gray-500">
          Loading graph visualization...
        </div>
      </div>
    );

  return (
    <div
      ref={containerRef}
      className="relative rounded-lg overflow-hidden border border-gray-200 shadow-lg"
      style={{
        width: "100%",
        height: "500px",
        maxWidth: "800px", // Control maximum width
      }}
    >
      <ForceGraph3D
        ref={fgRef}
        width={containerRef.current?.clientWidth || 600}
        height={500}
        graphData={data}
        nodeLabel={null} // Disable default hover tooltip since we're showing labels
        nodeRelSize={6}
        backgroundColor="#f8fafc"
        linkDirectionalArrowLength={5}
        linkDirectionalArrowRelPos={1}
        linkCurvature={0.3}
        linkWidth={1.5}
        linkOpacity={0.7}
        linkColor={() => "#5c6ac4"}
        onNodeClick={onNodeClick}
        nodeThreeObject={(node) => {
          // Group to hold both the sphere and text label
          const group = new THREE.Group();

          // Enhanced node styling with better materials and effects
          const nodeColor = colorPalette[node.type] || colorPalette.default;

          const nodeSize =
            {
              user: 9,
              userMessage: 7,
              aiMessage: 7,
              topic: 6,
            }[node.type] || 5;

          // Create geometry for the node
          const geometry = new THREE.SphereGeometry(nodeSize);

          // Create material with improved visual effects
          const material = new THREE.MeshPhongMaterial({
            color: nodeColor,
            transparent: true,
            opacity: 0.85,
            shininess: 80,
            specular: 0x111111,
          });

          // Create the node mesh
          const mesh = new THREE.Mesh(geometry, material);
          group.add(mesh);

          // Add a subtle glow effect for important nodes
          if (["user", "topic"].includes(node.type)) {
            const glowMaterial = new THREE.MeshBasicMaterial({
              color: nodeColor,
              transparent: true,
              opacity: 0.15,
            });
            const glowSphere = new THREE.Mesh(
              new THREE.SphereGeometry(nodeSize * 1.7),
              glowMaterial
            );
            mesh.add(glowSphere);
          }

          // Add text label to display node data by default
          const label = node.label || node.id || "";
          if (label) {
            const textSprite = new SpriteText(label);
            textSprite.color = "#ffffff";
            textSprite.backgroundColor = nodeColor;
            textSprite.padding = 2;
            textSprite.textHeight = 4;
            textSprite.position.y = nodeSize + 6;
            textSprite.borderRadius = 2;
            textSprite.fontWeight = "bold";
            group.add(textSprite);
          }

          return group;
        }}
        // Add ambient and directional lighting for 3D effect
        extraRendererConfig={{ antialias: true }}
        onRenderFramePre={(scene) => {
          if (!scene.userData.lightsAdded) {
            // Add ambient light
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            scene.add(ambientLight);

            // Add directional light
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(200, 200, 200);
            scene.add(directionalLight);

            scene.userData.lightsAdded = true;
          }
        }}
      />
    </div>
  );
};

export default GraphView;
