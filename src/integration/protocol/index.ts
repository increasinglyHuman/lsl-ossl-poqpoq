/**
 * Protocol — The typed contract between scripts and the host engine.
 *
 * ScriptCommand: script → host (API calls that need engine action)
 * ScriptEvent: host → script (world events dispatched to scripts)
 */

export type {
  // Geometry primitives
  Vec3,
  Quat,
  Color,
  // Command types
  ScriptCommand,
  ScriptCommandType,
  ScriptCommandEnvelope,
  CommandHandler,
  SetPositionCommand,
  SetRotationCommand,
  SetScaleCommand,
  SetColorCommand,
  SetAlphaCommand,
  SetTextureCommand,
  SetTextCommand,
  SetGlowCommand,
  SayCommand,
  WhisperCommand,
  ShoutCommand,
  RegionSayCommand,
  InstantMessageCommand,
  DialogCommand,
  PlaySoundCommand,
  StopSoundCommand,
  SetParticlesCommand,
  StopParticlesCommand,
  PlayAnimationCommand,
  StopAnimationCommand,
  ApplyForceCommand,
  ApplyImpulseCommand,
  SetPhysicsCommand,
  HttpRequestCommand,
  NpcCreateCommand,
  NpcRemoveCommand,
  NpcMoveToCommand,
  NpcSayCommand,
  NpcPlayAnimationCommand,
  NpcStopAnimationCommand,
  RequestPermissionsCommand,
} from "./script-command.js";

export type {
  // Event supporting types
  AgentInfo,
  ObjectInfo,
  // Event types
  ScriptEvent,
  ScriptEventType,
  ScriptEventEnvelope,
  TouchStartEvent,
  TouchEvent,
  TouchEndEvent,
  CollisionStartEvent,
  CollisionEvent,
  CollisionEndEvent,
  ListenEvent,
  TimerEvent,
  RezEvent,
  ChangedEvent,
  MoneyEvent,
  PermissionsEvent,
  SensorEvent,
  NoSensorEvent,
  DataserverEvent,
  HttpResponseEvent,
  PlayerEnterZoneEvent,
  PlayerLeaveZoneEvent,
  DayNightCycleEvent,
  WeatherChangeEvent,
} from "./script-event.js";
