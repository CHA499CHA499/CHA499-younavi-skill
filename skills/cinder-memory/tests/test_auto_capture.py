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

    def test_launch_consolidation_uses_one_shot_cinder_source(self) -> None:
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
            result = auto_capture.launch_consolidation(
                "agent-cli",
                date="2026-08-04",
                bundle_path="/tmp/user/cognition/cinder-memory/sessions/bundles/2026-08-04.md",
            )

        self.assertEqual(result["task_id"], "memory-task")
        command = run.call_args.args[0]
        self.assertEqual(command[:6], ["agent-cli", "--no-auto-start", "-f", "json", "chat", "send"])
        self.assertEqual(command[command.index("--source") + 1], "cinder_memory")
        self.assertIn("/cinder-memory 提炼今日记忆 2026-08-04", command[6])

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
        session_files = list((self.root / "sessions" / "2026-08-04").glob("*.md"))
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
            "launch_consolidation",
            return_value={"task_id": "memory-task", "conversation_id": "memory-conversation"},
        ) as launch:
            first = auto_capture.capture_completed_task(payload, cli_path="agent-cli", root=self.root)
            second = auto_capture.capture_completed_task(payload, cli_path="agent-cli", root=self.root)

        self.assertTrue(first["triggered"])
        self.assertEqual(second["skipped"], "consolidation already triggered")
        launch.assert_called_once()
        bundle = self.root / first["bundle"]
        self.assertIn("今天确认采用 session 日快照。", bundle.read_text(encoding="utf-8"))
        state_files = list((self.root / ".consolidation").glob("trigger-*.json"))
        self.assertEqual(len(state_files), 1)
        self.assertEqual(json.loads(state_files[0].read_text())["status"], "triggered")

    def test_consolidation_source_does_not_recurse(self) -> None:
        conversation = {
            "source": "cinder_memory",
            "messages": [{"role": "assistant", "content": "提炼完成"}],
        }
        with mock.patch.object(
            auto_capture, "call_conversation", return_value=conversation
        ), mock.patch.object(auto_capture, "launch_consolidation") as launch:
            result = auto_capture.capture_completed_task(
                {"conversation_id": "memory-conversation", "task_id": "memory-task"},
                cli_path="agent-cli",
                root=self.root,
            )

        self.assertEqual(result, {"skipped": "consolidation task"})
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
            "launch_consolidation",
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

    def test_skill_start_command_initializes_and_enables_capture(self) -> None:
        skill = (PLUGIN_ROOT / "SKILL.md").read_text(encoding="utf-8")

        self.assertIn("/cinder-memory 开始记忆", skill)
        self.assertIn("不再二次询问", skill)
        self.assertIn("把模板中的 `<skill-dir>` 替换", skill)
        self.assertIn("不得增加第二个相同 hook", skill)
        self.assertIn("目录已初始化，自动捕获未开启", skill)
        self.assertIn("/cinder-memory 提炼今日记忆", skill)


if __name__ == "__main__":
    unittest.main()
