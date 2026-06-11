import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { test } from "vitest";
import { requiredAnimationClipNames } from "../src/character/AnimationContract";
import {
  restPoseClipName,
  requiredRetargetHumanBoneNames,
  sourceBoneToHumanBone,
  vrm0HumanBoneAliases,
} from "../src/character/VrmAnimationContract";

interface GltfJson {
  animations: GltfAnimation[];
  nodes: GltfNode[];
  extensionsUsed?: string[];
  extensions?: {
    VRM?: {
      humanoid?: {
        humanBones?: Vrm0HumanBone[];
      };
    };
    VRMC_vrm?: {
      specVersion?: string;
      humanoid?: {
        humanBones?: Record<string, unknown>;
      };
    };
  };
}

interface GltfAnimation {
  name: string;
  channels: GltfAnimationChannel[];
}

interface GltfAnimationChannel {
  target: {
    node: number;
    path: string;
  };
}

interface GltfNode {
  name: string;
}

interface Vrm0HumanBone {
  bone: string;
}

const requiredNodes = ["root"];
const vrmCharacterAssets = ["sample.vrm", "sample2.vrm"];
const vrmCharacterVersions = new Map([
  ["sample.vrm", "0"],
  ["sample2.vrm", "1.0"],
]);
const animationLibraryJsonPromise = readGlbJson("src/assets/AnimationLibrary.glb");

test("animation library contains required model nodes and clips", async () => {
  const json = await animationLibraryJsonPromise;
  const clipNames = new Set(json.animations.map((clip) => clip.name));
  const nodeNames = new Set(json.nodes.map((node) => node.name));

  for (const clipName of requiredAnimationClipNames) {
    assert.equal(clipNames.has(clipName), true, `missing clip: ${clipName}`);
  }
  for (const nodeName of requiredNodes) {
    assert.equal(nodeNames.has(nodeName), true, `missing node: ${nodeName}`);
  }
});

test("animation library contains source humanoid quaternion tracks", async () => {
  const json = await animationLibraryJsonPromise;
  const sourceBoneNames = Object.keys(sourceBoneToHumanBone);
  const clipNames = [...requiredAnimationClipNames, restPoseClipName];

  for (const clipName of clipNames) {
    const trackNames = getAnimationTrackNames(json, clipName);
    assert.equal(
      trackNames.has("root.quaternion"),
      true,
      `missing ${clipName} track: root.quaternion`
    );
    for (const sourceBoneName of sourceBoneNames) {
      assert.equal(
        trackNames.has(`${sourceBoneName}.quaternion`),
        true,
        `missing ${clipName} track: ${sourceBoneName}.quaternion`
      );
    }
  }
});

test("bundled VRM avatars contain required humanoid bones", async () => {
  for (const assetName of vrmCharacterAssets) {
    const json = parseGlbJson(await readFile(`src/assets/${assetName}`));
    const humanBones = getVrmHumanBones(json);

    assert.equal(
      json.extensionsUsed?.some((name) => name.toLowerCase().includes("vrm")),
      true,
      `${assetName} is missing VRM extension`
    );
    assert.equal(
      getVrmVersion(json),
      vrmCharacterVersions.get(assetName),
      `${assetName} has unexpected VRM version`
    );
    for (const boneName of requiredRetargetHumanBoneNames) {
      assert.equal(
        humanBones.has(boneName),
        true,
        `${assetName} missing bone: ${boneName}`
      );
    }
  }
});

function parseGlbJson(bytes: Buffer): GltfJson {
  const magic = bytes.readUInt32LE(0);
  assert.equal(magic, 0x46546c67);
  let offset = 12;
  while (offset < bytes.length) {
    const chunkLength = bytes.readUInt32LE(offset);
    const chunkType = bytes.readUInt32LE(offset + 4);
    offset += 8;
    if (chunkType === 0x4e4f534a) {
      return JSON.parse(
        bytes.subarray(offset, offset + chunkLength).toString()
      ) as GltfJson;
    }
    offset += chunkLength;
  }
  throw new Error("Missing GLB JSON chunk.");
}

async function readGlbJson(path: string) {
  return parseGlbJson(await readFile(path));
}

function getAnimationTrackNames(json: GltfJson, clipName: string) {
  const animation = json.animations.find((item) => item.name === clipName);
  assert.ok(animation, `missing clip: ${clipName}`);
  return new Set(
    animation.channels.map((channel) => {
      const nodeName = THREE.PropertyBinding.sanitizeNodeName(
        json.nodes[channel.target.node].name
      );
      return `${nodeName}.${getThreeTrackPath(channel.target.path)}`;
    })
  );
}

function getThreeTrackPath(gltfPath: string) {
  if (gltfPath === "rotation") return "quaternion";
  if (gltfPath === "translation") return "position";
  return gltfPath;
}

function getVrmHumanBones(json: GltfJson) {
  const vrm1Bones = json.extensions?.VRMC_vrm?.humanoid?.humanBones;
  if (vrm1Bones) return new Set(Object.keys(vrm1Bones));

  return new Set(
    json.extensions?.VRM?.humanoid?.humanBones?.map(
      (bone) => vrm0HumanBoneAliases[bone.bone] ?? bone.bone
    ) ?? []
  );
}

function getVrmVersion(json: GltfJson) {
  if (json.extensions?.VRM) return "0";
  return json.extensions?.VRMC_vrm?.specVersion;
}
