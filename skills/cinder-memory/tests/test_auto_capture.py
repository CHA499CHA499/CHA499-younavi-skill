from __future__ import annotations

import json
import pathlib
import sys
import tempfile
import unittest
from unittest import mock


PLUGIN_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PLUGIN_ROOT / "hooks"))
sys.path.insert(0, str(PLUGIN_ROOT / "scripts"))

import auto_capture  # noqa: E402


class AutoCaptureTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = pathlib.Path(self.temporary.name) / "cinder-memory"

    def test_extract_last_completed_exchange_for_task(self) -> None:
        conversation = {
            "messages": [
                {"role": "user", "content": "第一问"},
                {"role": "assistant", "content": "第一答", "task_id": "task-1"},
                {"role": "user", "content": "最后一问"},
                {
                    "role": "assistant",
                    "content": "未完成",
                    "task_id": "task-2",
                    "is_complete": False,
                },
                {
                    "role": "assistant",
                    "content": "最后一答",
                    "task_id": "task-2",
                    "is_complete": True,
                },
            ]
        }

        result = auto_capture.extract_last_exchange(conversation, "task-2")

        self.assertEqual(result, ("最后一问", "最后一答"))

    def test_session_transcript_only_keeps_requested_day_when_timestamps_exist(self) -> None:
        conversation = {
            "messages": [
                {
                    "role": "user",
                    "content": "昨天的问题",
                    "created_at": "2026-08-03T23:00:00+08:00",
                },
                {
                    "role": "assistant",
                    "content": "昨天的回答",
                    "created_at": "2026-08-03T23:01:00+08:00",
                },
                {
                    "role": "user",
                    "content": "今天的问题",
                    "created_at": "2026-08-04T09:00:00+08:00",
                },
                {
                    "role": "assistant",
                    "content": "今天的回答",
                    "created_at": "2026-08-04T09:01:00+08:00",
                },
            ]
        }

        transcript = auto_capture.render_session_transcript(conversation, "2026-08-04")

        self.assertNotIn("昨天", transcript or "")
        self.assertIn("今天的问题", transcript or "")
        self.assertIn("今天的回答", transcript or "")

    def test_launch_extraction_uses_single_json_output_task(self) -> None:
        completed = mock.Mock(
            returncode=0,
            stdout=json.dumps(
                {
                    "success": True,
                    "data": {
                        "task_id": "memory-task",
                        "conversation_id": "memory-conversation",
                    },
                }
            ),
            stderr="",
        )
        with mock.patch.object(auto_capture.subprocess, "run", return_value=completed) as run:
            result = auto_capture.launch_extraction(
                "agent-cli",
                date="2026-08-04",
                evidence="allowed_source_refs: [incoming/2026-08-04/evening-report.md]",
            )

        self.assertEqual(result["task_id"], "memory-task")
        command = run.call_args.args[0]
        self.assertEqual(command[:6], ["agent-cli", "--no-auto-start", "-f", "json", "chat", "send"])
        self.assertEqual(command[command.index("--source") + 1], "cinder_memory_extract")
        self.assertIn('"schema_version": 1', command[6])
        self.assertIn("不要调用任何工具", command[6])

    def test_completed_task_overwrites_one_daily_session_snapshot(self) -> None:
        conversation = {
            "title": "项目\n讨论",
            "source": "app",
            "updated_at": "2026-08-04T10:00:00+08:00",
            "messages": [
                {
                    "role": "user",
                    "content": "请记下结论",
                    "created_at": "2026-08-04T09:59:00+08:00",
                },
                {
                    "role": "assistant",
                    "content": "采用用户目录下的 Markdown。",
                    "task_id": "task-1",
                    "is_complete": True,
                    "created_at": "2026-08-04T10:00:00+08:00",
                },
            ],
        }
        payload = {"conversation_id": "conversation-1", "task_id": "task-1"}

        with mock.patch.object(
            auto_capture, "call_conversation", return_value=conversation
        ), mock.patch.object(auto_capture.memory_fs, "today_local", return_value="2026-08-04"):
            first = auto_capture.capture_completed_task(payload, cli_path="agent-cli", root=self.root)
            conversation["messages"].extend(
                [
                    {
                        "role": "user",
                        "content": "再补一条",
                        "created_at": "2026-08-04T10:05:00+08:00",
                    },
                    {
                        "role": "assistant",
                        "content": "晚报时统一提炼。",
                        "task_id": "task-2",
                        "is_complete": True,
                        "created_at": "2026-08-04T10:06:00+08:00",
                    },
                ]
            )
            second = auto_capture.capture_completed_task(
                {"conversation_id": "conversation-1", "task_id": "task-2"},
                cli_path="agent-cli",
                root=self.root,
            )

        self.assertTrue(first["created"])
        self.assertFalse(second["created"])
        self.assertTrue(second["changed"])
        session_files = list((self.root / "incoming" / "2026-08-04").glob("conversation-*.md"))
        self.assertEqual(len(session_files), 1)
        content = session_files[0].read_text(encoding="utf-8")
        self.assertIn("# 项目 讨论", content)
        self.assertIn("再补一条", content)
        self.assertEqual(list((self.root / "inbox").glob("*.md")), [])

    def test_missing_conversation_id_skips_without_cli_call(self) -> None:
        with mock.patch.object(auto_capture, "call_conversation") as call:
            result = auto_capture.capture_completed_task(
                {"task_id": "task-1"}, cli_path="agent-cli", root=self.root
            )

        self.assertEqual(result, {"skipped": "missing conversation_id"})
        call.assert_not_called()

    def test_no_complete_session_message_is_skipped(self) -> None:
        conversation = {
            "messages": [
                {"role": "user", "content": "问题"},
                {
                    "role": "assistant",
                    "content": "还在生成",
                    "task_id": "task-1",
                    "is_complete": False,
                },
            ]
        }

        with mock.patch.object(auto_capture, "call_conversation", return_value=conversation):
            result = auto_capture.capture_completed_task(
                {"conversation_id": "conversation-1", "task_id": "task-1"},
                cli_path="agent-cli",
                root=self.root,
            )

        self.assertEqual(result, {"skipped": "no completed session messages"})

    def test_evening_report_triggers_one_consolidation_task(self) -> None:
        conversation = {
            "title": "晚间简报 2026-08-04",
            "source": "evening_report",
            "messages": [
                {"role": "user", "content": "生成晚报"},
                {
                    "role": "assistant",
                    "content": "今天确认采用 session 日快照。",
                    "task_id": "report-task",
                    "is_complete": True,
                },
            ],
        }
        payload = {"conversation_id": "report-conversation", "task_id": "report-task"}

        with mock.patch.object(
            auto_capture, "call_conversation", return_value=conversation
        ), mock.patch.object(
            auto_capture.memory_fs, "today_local", return_value="2026-08-04"
        ), mock.patch.object(
            auto_capture,
            "launch_extraction",
            return_value={"task_id": "memory-task", "conversation_id": "memory-conversation"},
        ) as launch:
            first = auto_capture.capture_completed_task(payload, cli_path="agent-cli", root=self.root)
            second = auto_capture.capture_completed_task(payload, cli_path="agent-cli", root=self.root)

        self.assertTrue(first["triggered"])
        self.assertEqual(second["skipped"], "consolidation already triggered")
        launch.assert_called_once()
        bundle = self.root / first["bundle"]
        self.assertIn("今天确认采用 session 日快照。", bundle.read_text(encoding="utf-8"))
        state_files = list((self.root / ".state" / "consolidation").glob("trigger-*.json"))
        self.assertEqual(len(state_files), 1)
        self.assertEqual(json.loads(state_files[0].read_text())["status"], "triggered")

    def test_legacy_consolidation_source_does_not_recurse(self) -> None:
        conversation = {
            "source": "cinder_memory",
            "messages": [{"role": "assistant", "content": "提炼完成"}],
        }
        with mock.patch.object(
            auto_capture, "call_conversation", return_value=conversation
        ), mock.patch.object(auto_capture, "launch_extraction") as launch:
            result = auto_capture.capture_completed_task(
                {"conversation_id": "memory-conversation", "task_id": "memory-task"},
                cli_path="agent-cli",
                root=self.root,
            )

        self.assertEqual(result, {"skipped": "legacy consolidation task"})
        launch.assert_not_called()

    def test_extraction_source_applies_plan_without_launching_another_task(self) -> None:
        auto_capture.memory_fs.record_session_snapshot(
            self.root,
            date="2026-08-04",
            conversation_id="source-conversation",
            task_id="source-task",
            title="项目讨论",
            source="app",
            updated_at="2026-08-04T11:00:00+08:00",
            transcript="用户明确决定采用 Markdown 记忆。",
        )
        bundle = auto_capture.memory_fs.build_extraction_input(
            self.root,
            date="2026-08-04",
            report_title="晚报",
            report_content="今天确定使用 Markdown。",
            report_source="conversation:report#task:report",
        )
        source_ref = next(
            item for item in bundle["allowed_source_refs"] if "conversation-" in item
        )
        auto_capture.memory_fs.claim_consolidation_trigger(
            self.root, report_task_id="report-task", date="2026-08-04"
        )
        auto_capture.memory_fs.finish_consolidation_trigger(
            self.root,
            report_task_id="report-task",
            date="2026-08-04",
            task_id="memory-task",
            conversation_id="memory-conversation",
        )
        plan = {
            "schema_version": 1,
            "date": "2026-08-04",
            "digest": {
                "title": "今日记忆",
                "summary": "确定使用 Markdown。",
                "tags": ["记忆"],
                "source_refs": [source_ref],
            },
            "memories": [
                {
                    "canonical_key": "project.memory.format",
                    "memory_type": "project_decision",
                    "title": "记忆格式",
                    "summary": "采用 Markdown。",
                    "content": "项目决定使用 Markdown 文件保存记忆。",
                    "tags": ["Markdown"],
                    "entities": ["cinder-memory"],
                    "source_refs": [source_ref],
                    "confidence": "high",
                }
            ],
            "candidates": [],
        }
        conversation = {
            "source": "cinder_memory_extract",
            "messages": [
                {"role": "user", "content": "提取"},
                {
                    "role": "assistant",
                    "content": json.dumps(plan, ensure_ascii=False),
                    "task_id": "memory-task",
                    "is_complete": True,
                },
            ],
        }

        with mock.patch.object(
            auto_capture, "call_conversation", return_value=conversation
        ), mock.patch.object(auto_capture, "launch_extraction") as launch:
            result = auto_capture.capture_completed_task(
                {"conversation_id": "memory-conversation", "task_id": "memory-task"},
                cli_path="agent-cli",
                root=self.root,
            )

        self.assertTrue(result["applied"])
        self.assertEqual(result["created"], 1)
        state_files = list((self.root / ".state" / "consolidation").glob("trigger-*.json"))
        self.assertEqual(json.loads(state_files[0].read_text())["status"], "applied")
        launch.assert_not_called()

    def test_failed_launch_releases_claim_for_retry(self) -> None:
        conversation = {
            "title": "晚报",
            "source": "evening_report",
            "messages": [
                {"role": "user", "content": "生成晚报"},
                {
                    "role": "assistant",
                    "content": "晚报正文",
                    "task_id": "report-task",
                },
            ],
        }
        payload = {"conversation_id": "report-conversation", "task_id": "report-task"}
        success = {"task_id": "memory-task", "conversation_id": "memory-conversation"}
        with mock.patch.object(
            auto_capture, "call_conversation", return_value=conversation
        ), mock.patch.object(
            auto_capture.memory_fs, "today_local", return_value="2026-08-04"
        ), mock.patch.object(
            auto_capture,
            "launch_extraction",
            side_effect=[auto_capture.memory_fs.MemoryPluginError("offline"), success],
        ):
            with self.assertRaisesRegex(auto_capture.memory_fs.MemoryPluginError, "offline"):
                auto_capture.capture_completed_task(payload, cli_path="agent-cli", root=self.root)
            retried = auto_capture.capture_completed_task(payload, cli_path="agent-cli", root=self.root)

        self.assertTrue(retried["triggered"])

    def test_hook_template_uses_skill_directory_placeholder(self) -> None:
        template = json.loads(
            (PLUGIN_ROOT / "hooks" / "task-completed.example.json").read_text(encoding="utf-8")
        )
        hook = template["hooks"]["task.completed"][0]["hooks"][0]

        self.assertEqual(hook["type"], "script")
        self.assertEqual(
            hook["script_path"],
            "<skill-dir>/hooks/auto_capture.py",
        )
        self.assertTrue(hook["async_mode"])
        self.assertEqual(hook["timeout_ms"], 60000)

    def test_skill_start_command_accepts_broad_activation_phrases(self) -> None:
        skill = (PLUGIN_ROOT / "SKILL.md").read_text(encoding="utf-8")

        self.assertIn("/cinder-memory 启动", skill)
        self.assertIn("version: 0.3.1", skill)
        self.assertIn("个人知识库", skill)
        self.assertIn("帮我记一下", skill)
        self.assertIn("`开始`、`开启`、`开始记忆`、`开启记忆`", skill)
        self.assertIn("单纯询问功能、状态或用法不等于授权", skill)
        self.assertIn("不再二次询问", skill)
        self.assertIn("把模板中的 `<skill-dir>` 替换", skill)
        self.assertIn("不得增加第二个相同 hook", skill)
        self.assertIn("目录已初始化，自动捕获未开启", skill)
        self.assertIn("source=cinder_memory_extract", skill)
        self.assertIn('"action": "search"', skill)
        self.assertIn('"action": "read"', skill)


if __name__ == "__main__":
    unittest.main()
