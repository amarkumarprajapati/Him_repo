"use client";

import { useState, useMemo, memo, Fragment, useEffect, useCallback } from "react";
import { Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { MapNode } from "@/types";

function getNodeId(node: MapNode) {
  return node.node_id || node.device_id;
}

function NodeMarker({
  node,
  nodeIcon,
  labelIcon,
  onRightClick,
  onClick,
}: {
  node: MapNode;
  nodeIcon: L.DivIcon;
  labelIcon: L.DivIcon;
  onRightClick: (node: MapNode, e: L.LeafletMouseEvent) => void;
  onClick: (node: MapNode, e: L.LeafletMouseEvent) => void;
}) {
  const handlers = useMemo(() => ({
    click: (e: L.LeafletMouseEvent) => onClick(node, e),
    contextmenu: (e: L.LeafletMouseEvent) => {
      e.originalEvent.preventDefault();
      e.originalEvent.stopPropagation();
      onRightClick(node, e);
    },
  }), [node, onClick, onRightClick]);

  return (
    <Fragment>
      <Marker position={[node.latitude, node.longitude]} icon={labelIcon} interactive={false} />
      <Marker position={[node.latitude, node.longitude]} icon={nodeIcon} eventHandlers={handlers} />
    </Fragment>
  );
}

const MemoNodeMarker = memo(NodeMarker);

export const VisibleNodes = memo(function VisibleNodes({
  nodes,
  nodeIcons,
  labelIcons,
  onRightClick,
  onClick,
}: {
  nodes: MapNode[];
  nodeIcons: Record<string, L.DivIcon>;
  labelIcons: Record<string, L.DivIcon>;
  onRightClick: (node: MapNode, e: L.LeafletMouseEvent) => void;
  onClick: (node: MapNode, e: L.LeafletMouseEvent) => void;
}) {
  const map = useMap();
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);

  const updateBounds = useCallback(() => {
    if (map) setBounds(map.getBounds());
  }, [map]);

  useEffect(() => { updateBounds(); }, [updateBounds]);

  useMapEvents({ zoomend: updateBounds, moveend: updateBounds });

  const visibleNodes = useMemo(() => {
    if (!bounds) return [];
    return nodes?.filter((n) => n && n.latitude != null && n.longitude != null && bounds.pad(0.3).contains([n.latitude, n.longitude]));
  }, [bounds, nodes]);

  return (
    <>
      {visibleNodes?.map((node, index) => {
        const id = getNodeId(node);
        return (
          <MemoNodeMarker
            key={id || `node-${index}`}
            node={node}
            nodeIcon={nodeIcons[id]}
            labelIcon={labelIcons[id]}
            onRightClick={onRightClick}
            onClick={onClick}
          />
        );
      })}
    </>
  );
});
