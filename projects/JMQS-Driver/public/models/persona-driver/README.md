# Modular Persona Driver Models

原创 Persona Driver 的离线出帧源资产。四个 GLB 只允许由 Blender 脚本读取，浏览器运行时不得加载。

- `belt.glb`：空载腰带本体；包含 `MainCardSlot_Root`、`LeftRodDock_Pivot`、`RightRodDock_Pivot`。
- `persona-card.glb`：人物主卡；根节点 `PersonaCard_Root`。
- `energy-rod.glb`：青色能量棒；根节点 `EnergyRod_Root`。
- `skill-rod.glb`：琥珀色技能棒；根节点 `SkillRod_Root`。

模型属于历史源资产，不进入当前网页运行链路。当前网页只读取 `public/driver-textures/` 中批准的二维元素图；不要用这些模型重新覆盖二维贴图。

`textures/brushed-gunmetal-v1.png` 是项目自有的无标识拉丝枪灰贴图，只用于 Blender 离线渲染；网页不执行材质计算。
