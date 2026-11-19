"""Engine stage wrappers (card 04). Each module returns Steps; cli.py runs them. Every tool is an external process."""
from . import building, export, intake, paid, plan, scene

REGISTRY = {
    "intake": intake.steps,
    "plan": plan.steps,
    "building": building.steps,
    "scene": scene.scene_steps,
    "clay": scene.clay_steps,
    "skin": paid.skin_steps,
    "video": paid.video_steps,
    "export": export.steps,
}
