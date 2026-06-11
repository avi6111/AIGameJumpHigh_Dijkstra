import type * as THREE from "three";
import { scheduleAfterNextFrame, waitForNextFrame } from "../utils/FrameYield";
import { AnimatedCharacterModel } from "./AnimatedCharacterModel";
import {
  DEFAULT_CHARACTER_SHADOW_SETTINGS,
  type CharacterShadowInspectorControls,
  type CharacterShadowSettings,
} from "./CharacterShadowSettings";

interface CharacterHost {
  add(child: THREE.Object3D): void;
  remove(child: THREE.Object3D): void;
}

interface CharacterModelRuntimeOptions {
  warmUp?(model: AnimatedCharacterModel): Promise<void>;
}

export function createCharacterModelRuntime(
  host: CharacterHost,
  options: CharacterModelRuntimeOptions = {}
) {
  let currentModel: AnimatedCharacterModel | null = null;
  let loadFailed = false;
  let loadVersion = 0;
  let loading = false;
  let loadingText: string | null = null;
  let pendingLoad: { loadModel: () => Promise<AnimatedCharacterModel>; text: string } | null = null;
  let elapsedTime = 0;
  let noticeMessage: string | null = null;
  let noticeMessageUntil = 0;
  const shadowSettings: CharacterShadowSettings = {
    ...DEFAULT_CHARACTER_SHADOW_SETTINGS,
  };

  const load = async (
    loadModel: () => Promise<AnimatedCharacterModel>,
    text: string
  ) => {
    if (loading) {
      pendingLoad = { loadModel, text };
      setNoticeMessage(text, Number.POSITIVE_INFINITY);
      return;
    }

    const version = loadVersion + 1;
    loadVersion = version;
    loading = true;
    loadingText = text;
    loadFailed = false;
    clearNoticeMessage();

    try {
      await waitForNextFrame();
      if (version !== loadVersion) return;
      const model = await loadModel();
      if (version !== loadVersion) {
        model.dispose();
        return;
      }
      if (options.warmUp) {
        await waitForNextFrame();
        if (version !== loadVersion) {
          model.dispose();
          return;
        }
        await options.warmUp(model);
        if (version !== loadVersion) {
          model.dispose();
          return;
        }
      }
      model.setShadowSettings(shadowSettings);
      replaceModel(model);
      setNoticeMessage(
        `${model.vrmVersionLabel} LOADED: ${shortenName(model.sourceName)}`,
        2
      );
    } catch (error) {
      if (version !== loadVersion) return;
      loadFailed = currentModel === null;
      setNoticeMessage(loadFailed ? "CHARACTER LOAD FAILED" : "VRM LOAD FAILED", 3);
      console.error("Failed to load animated character model.", error);
    } finally {
      if (version === loadVersion) {
        loading = false;
        loadingText = null;
        drainPendingLoad();
      }
    }
  };

  const replaceModel = (model: AnimatedCharacterModel) => {
    const previous = currentModel;
    if (previous) {
      host.remove(previous.group);
      scheduleAfterNextFrame(() => {
        previous.dispose();
      });
    }
    currentModel = model;
    host.add(model.group);
  };

  const drainPendingLoad = () => {
    const next = pendingLoad;
    pendingLoad = null;
    if (next) void load(next.loadModel, next.text);
  };

  const setNoticeMessage = (message: string, duration: number) => {
    noticeMessage = message;
    noticeMessageUntil = Number.isFinite(duration)
      ? elapsedTime + duration
      : Number.POSITIVE_INFINITY;
  };

  const clearNoticeMessage = () => {
    noticeMessage = null;
    noticeMessageUntil = 0;
  };

  const shadowControls: CharacterShadowInspectorControls = {
    get castShadow() {
      return shadowSettings.castShadow;
    },
    set castShadow(value) {
      if (value === shadowSettings.castShadow) return;
      shadowSettings.castShadow = value;
      currentModel?.setShadowSettings(shadowSettings);
    },
    get receiveShadow() {
      return shadowSettings.receiveShadow;
    },
    set receiveShadow(value) {
      if (value === shadowSettings.receiveShadow) return;
      shadowSettings.receiveShadow = value;
      currentModel?.setShadowSettings(shadowSettings);
    },
  };

  return {
    shadowControls,
    loadDefault() {
      void load(() => AnimatedCharacterModel.load(), "LOADING CHARACTER");
    },
    loadFile(file: File) {
      void load(
        () => AnimatedCharacterModel.loadFromFile(file),
        `LOADING ${shortenName(file.name)}`
      );
    },
    loadUrl(url: string, name: string) {
      void load(
        () => AnimatedCharacterModel.loadFromUrl(url, name),
        `LOADING ${shortenName(name)}`
      );
    },
    showMessage(message: string, duration = 2) {
      setNoticeMessage(message, duration);
    },
    update(delta: number, elapsed: number) {
      elapsedTime = elapsed;
      currentModel?.update(delta);
    },
    getStatusMessage(elapsed: number) {
      if (noticeMessage && elapsed < noticeMessageUntil) return noticeMessage;
      if (noticeMessage && elapsed >= noticeMessageUntil) clearNoticeMessage();
      if (loadingText) return loadingText;
      if (!currentModel && !loadFailed) return "LOADING CHARACTER";
      if (loadFailed) return "CHARACTER LOAD FAILED";
      return null;
    },
    dispose() {
      loadVersion += 1;
      pendingLoad = null;
      if (!currentModel) return;
      host.remove(currentModel.group);
      currentModel.dispose();
      currentModel = null;
    },
  };
}

function shortenName(name: string) {
  if (name.length <= 32) return name;
  return `${name.slice(0, 14)}...${name.slice(-14)}`;
}
