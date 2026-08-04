from __future__ import annotations

import contextlib
import io
import json
import os
import pathlib
import sys
import tempfile
import unittest
from unittest import mock


PLUGIN_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PLUGIN_ROOT / "scripts"))

import memory_fs  # noqa: E402


class MemoryFileSystemTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.base = pathlib.Path(self.temporary.name)
        self.user_dir = self.base / "test-user"
        self.root = memory_fs.data_root(self.user_dir)

    def test_init_creates_file_native_layout_and_index(self) -> None:
        result = memory_fs.status(self.root)

        self.assertEqual(result["version"], "0.3.1")
        self.assertEqual(result["data_root"], str(self.root))
        self.assertEqual(result["pending_days"], 0)
        self.assertTrue((self.root / "MEMORY.md").is_file())
        self.assertTrue((self.root / "memory_summary.md").is_file())
        for directory in (
            *(pathlib.Path("memory") / category for category in memory_fs.CATEGORIES),
            "incoming",
            "digests",
            "inbox",
            "archive",
            ".requests",
            pathlib.Path(".state") / "consolidation",
            pathlib.Path(".state") / "applied",
        ):
            self.assertTrue((self.root / directory).is_dir())

    def test_infers_user_directory_from_installed_skill_path(self) -> None:
        fake_script = self.user_dir / "skills" / "cinder-memory" / "scripts" / "memory_fs.py"

        with mock.patch.dict(
            os.environ,
            {"YOUNAVI_USER_WORK_DIR": "", "YOUNAVI_USER_DIR": ""},
        ), mock.patch.object(memory_fs, "__file__", str(fake_script)):
            inferred = memory_fs.resolve_user_dir()

        self.assertEqual(inferred, self.user_dir.resolve())

    def test_hook_user_work_dir_takes_precedence_over_script_path(self) -> None:
        configured = self.base / "hook-user"

        with mock.patch.dict(os.environ, {"YOUNAVI_USER_WORK_DIR": str(configured)}):
            inferred = memory_fs.resolve_user_dir()

        self.assertEqual(inferred, configured.resolve())

    def test_capture_is_idempotent(self) -> None:
        first = memory_fs.capture(
            self.root,
            title="项目偏好",
            content="先小范围验证，再扩大。",
            source="conversation:one#task:one",
            date="2026-08-03",
        )
        second = memory_fs.capture(
            self.root,
            title="项目偏好",
            content="先小范围验证，再扩大。",
            source="conversation:one#task:one",
            date="2026-08-03",
        )

        self.assertTrue(first["created"])
        self.assertFalse(second["created"])
        content = (self.root / "inbox" / "2026-08-03.md").read_text(encoding="utf-8")
        self.assertEqual(content.count("cinder-memory:id="), 1)

    def test_remember_rebuilds_index_and_expand_matches_chinese(self) -> None:
        result = memory_fs.remember(
            self.root,
            category="preferences",
            slug="answer-style",
            title="回答风格",
            content="用户偏好先给结论，再补必要依据。",
            source="conversation:style",
        )

        self.assertEqual(result["path"], "memory/preferences/answer-style.md")
        index = (self.root / "MEMORY.md").read_text(encoding="utf-8")
        self.assertIn("memory/preferences/answer-style.md", index)
        expanded = memory_fs.expand(self.root, query="回答时先给结论")
        self.assertEqual(expanded["matches"][0]["path"], "memory/preferences/answer-style.md")

    def test_nested_topic_file_is_included_in_its_category(self) -> None:
        memory_fs.ensure_layout(self.root)
        nested = self.root / "projects" / "alpha" / "decision.md"
        nested.parent.mkdir(parents=True)
        nested.write_text("# Alpha 决策\n\n采用文件式记忆。\n", encoding="utf-8")

        memory_fs.rebuild_index(self.root)

        index = (self.root / "MEMORY.md").read_text(encoding="utf-8")
        self.assertIn("projects/alpha/decision.md", index)

    def test_reindex_on_fresh_root_creates_complete_layout(self) -> None:
        index = memory_fs.rebuild_index(self.root)

        self.assertTrue(index.is_file())
        for directory in (
            *(pathlib.Path("memory") / category for category in memory_fs.CATEGORIES),
            "incoming",
            "digests",
            "inbox",
            "archive",
            ".requests",
            pathlib.Path(".state") / "consolidation",
            pathlib.Path(".state") / "applied",
        ):
            self.assertTrue((self.root / directory).is_dir())

    def test_session_snapshot_is_overwritten_per_conversation_and_day(self) -> None:
        first = memory_fs.record_session_snapshot(
            self.root,
            date="2026-08-04",
            conversation_id="conversation-1",
            task_id="task-1",
            title="项目讨论",
            source="app",
            updated_at="2026-08-04T10:00:00+08:00",
            transcript="## 用户\n\n第一问\n\n## Navi\n\n第一答",
        )
        second = memory_fs.record_session_snapshot(
            self.root,
            date="2026-08-04",
            conversation_id="conversation-1",
            task_id="task-2",
            title="项目讨论",
            source="app",
            updated_at="2026-08-04T11:00:00+08:00",
            transcript="## 用户\n\n第二问\n\n## Navi\n\n第二答",
        )

        self.assertTrue(first["created"])
        self.assertFalse(second["created"])
        self.assertEqual(first["path"], second["path"])
        self.assertTrue(first["path"].startswith("incoming/2026-08-04/conversation-"))
        snapshots = memory_fs.list_session_snapshots(self.root, "2026-08-04")
        self.assertEqual(snapshots["total"], 1)
        content = (self.root / second["path"]).read_text(encoding="utf-8")
        self.assertNotIn("第一问", content)
        self.assertIn("第二问", content)

    def test_session_snapshots_are_not_part_of_normal_expand(self) -> None:
        memory_fs.record_session_snapshot(
            self.root,
            date="2026-08-04",
            conversation_id="conversation-private",
            task_id="task-private",
            title="原始会话",
            source="app",
            updated_at="2026-08-04T11:00:00+08:00",
            transcript="只存在原始快照的独特词语火山玻璃",
        )

        expanded = memory_fs.expand(self.root, query="火山玻璃")

        self.assertEqual(expanded["matches"], [])

    def test_progressive_search_then_read_does_not_return_raw_content_first(self) -> None:
        remembered = memory_fs.remember(
            self.root,
            category="preferences",
            slug="brief-answer",
            title="回答长度",
            content="用户偏好简洁回答。",
            source="conversation:brief",
        )

        searched = memory_fs.search_memory(self.root, query="简洁回答")
        self.assertEqual(searched["matches"][0]["path"], remembered["path"])
        self.assertNotIn("content", searched["matches"][0])
        read = memory_fs.read_memory_paths(self.root, paths=[remembered["path"]])
        self.assertIn("用户偏好简洁回答", read["items"][0]["content"])

    def test_apply_extraction_plan_writes_digest_memory_and_inbox(self) -> None:
        memory_fs.record_session_snapshot(
            self.root,
            date="2026-08-04",
            conversation_id="conversation-1",
            task_id="task-1",
            title="项目讨论",
            source="app",
            updated_at="2026-08-04T11:00:00+08:00",
            transcript="用户明确决定采用文件式记忆。",
        )
        bundle = memory_fs.build_extraction_input(
            self.root,
            date="2026-08-04",
            report_title="晚报",
            report_content="今天确定采用文件式记忆。",
            report_source="conversation:report#task:report",
        )
        source_ref = next(
            item for item in bundle["allowed_source_refs"] if "conversation-" in item
        )
        plan = {
            "schema_version": 1,
            "date": "2026-08-04",
            "digest": {
                "title": "今日记忆",
                "summary": "确定采用文件式记忆。",
                "tags": ["记忆"],
                "source_refs": [source_ref],
            },
            "memories": [
                {
                    "canonical_key": "project.memory.storage",
                    "memory_type": "project_decision",
                    "title": "记忆存储方案",
                    "summary": "采用文件式记忆。",
                    "content": "项目已经决定使用用户目录下的 Markdown 文件。",
                    "tags": ["记忆", "Markdown"],
                    "entities": ["cinder-memory"],
                    "source_refs": [source_ref],
                    "confidence": "high",
                },
                {
                    "canonical_key": "project.memory.future",
                    "memory_type": "project_decision",
                    "title": "可能的后续方向",
                    "summary": "可能加入向量检索。",
                    "content": "该内容尚未确认。",
                    "tags": ["候选"],
                    "entities": [],
                    "source_refs": [source_ref],
                    "confidence": "medium",
                },
            ],
            "candidates": [],
        }

        first = memory_fs.apply_extraction_plan(
            self.root, plan=plan, expected_date="2026-08-04"
        )
        second = memory_fs.apply_extraction_plan(
            self.root, plan=plan, expected_date="2026-08-04"
        )

        self.assertEqual(first, second)
        self.assertEqual(first["created"], 1)
        self.assertEqual(first["inbox"], 1)
        self.assertTrue((self.root / first["digest"]).is_file())
        self.assertTrue((self.root / first["written_paths"][0]).is_file())
        self.assertTrue((self.root / "inbox" / "2026-08-04.md").is_file())

    def test_apply_extraction_plan_rejects_unregistered_sources(self) -> None:
        memory_fs.record_session_snapshot(
            self.root,
            date="2026-08-04",
            conversation_id="conversation-1",
            task_id="task-1",
            title="项目讨论",
            source="app",
            updated_at="2026-08-04T11:00:00+08:00",
            transcript="有来源的内容。",
        )
        memory_fs.build_extraction_input(
            self.root,
            date="2026-08-04",
            report_title="晚报",
            report_content="晚报内容。",
            report_source="conversation:report#task:report",
        )
        plan = {
            "schema_version": 1,
            "date": "2026-08-04",
            "digest": {
                "title": "错误来源",
                "summary": "不能接受。",
                "tags": [],
                "source_refs": ["incoming/2026-08-04/not-real.md"],
            },
            "memories": [],
            "candidates": [],
        }

        with self.assertRaisesRegex(memory_fs.MemoryPluginError, "source_refs"):
            memory_fs.apply_extraction_plan(
                self.root, plan=plan, expected_date="2026-08-04"
            )

    def test_extraction_input_obeys_token_budget(self) -> None:
        self.assertEqual(memory_fs.MAX_REPORT_ESTIMATED_TOKENS, 2_000)
        self.assertEqual(memory_fs.MAX_EXTRACTION_ESTIMATED_TOKENS, 8_000)
        for index in range(3):
            memory_fs.record_session_snapshot(
                self.root,
                date="2026-08-04",
                conversation_id=f"conversation-{index}",
                task_id=f"task-{index}",
                title=f"会话 {index}",
                source="app",
                updated_at="2026-08-04T11:00:00+08:00",
                transcript=(f"session-{index}-" * 8_000),
            )

        bundle = memory_fs.build_extraction_input(
            self.root,
            date="2026-08-04",
            report_title="晚报",
            report_content="晚报内容" * 5_000,
            report_source="conversation:report#task:report",
        )

        text = pathlib.Path(bundle["absolute_path"]).read_text(encoding="utf-8")
        self.assertLessEqual(
            memory_fs.estimate_tokens(text), memory_fs.MAX_EXTRACTION_ESTIMATED_TOKENS
        )
        self.assertTrue(bundle["truncated"])
        self.assertIn("input truncated", text)
        self.assertEqual(bundle["included_sessions"], 3)

    def test_consolidation_trigger_claim_is_idempotent_and_releasable(self) -> None:
        first = memory_fs.claim_consolidation_trigger(
            self.root, report_task_id="report-task", date="2026-08-04"
        )
        second = memory_fs.claim_consolidation_trigger(
            self.root, report_task_id="report-task", date="2026-08-04"
        )

        self.assertTrue(first["claimed"])
        self.assertFalse(second["claimed"])
        memory_fs.release_consolidation_trigger(self.root, report_task_id="report-task")
        third = memory_fs.claim_consolidation_trigger(
            self.root, report_task_id="report-task", date="2026-08-04"
        )
        self.assertTrue(third["claimed"])

    def test_request_file_is_consumed_after_processing(self) -> None:
        request_file = pathlib.Path(memory_fs.status(self.root)["request_file"])
        request_file.write_text(
            json.dumps(
                {
                    "action": "remember",
                    "category": "profile",
                    "slug": "role",
                    "title": "角色",
                    "content": "用户负责产品设计。",
                    "source": "conversation:role",
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )

        result = memory_fs.consume_request(self.root, str(request_file))

        self.assertEqual(result["path"], "memory/profile/role.md")
        self.assertFalse(request_file.exists())

    def test_request_outside_requests_directory_is_rejected(self) -> None:
        memory_fs.ensure_layout(self.root)
        outside = self.base / "outside.json"
        outside.write_text('{"action":"pending"}', encoding="utf-8")

        with self.assertRaisesRegex(memory_fs.MemoryPluginError, "inside .requests"):
            memory_fs.consume_request(self.root, str(outside))

        self.assertTrue(outside.exists())

    def test_forget_requires_confirmation_and_moves_file(self) -> None:
        memory_fs.remember(
            self.root,
            category="preferences",
            slug="old-style",
            title="旧偏好",
            content="使用旧格式。",
            source="conversation:old",
        )

        with self.assertRaisesRegex(memory_fs.MemoryPluginError, "confirmed=true"):
            memory_fs.forget(
                self.root,
                relative_path="memory/preferences/old-style.md",
                confirmed=False,
            )

        result = memory_fs.forget(
            self.root,
            relative_path="memory/preferences/old-style.md",
            confirmed=True,
        )
        self.assertFalse((self.root / "memory" / "preferences" / "old-style.md").exists())
        self.assertTrue((self.root / result["archived_to"]).is_file())

    def test_forget_rejects_internal_request_files(self) -> None:
        memory_fs.ensure_layout(self.root)
        internal = self.root / ".requests" / "note.md"
        internal.write_text("internal", encoding="utf-8")

        with self.assertRaisesRegex(memory_fs.MemoryPluginError, "cannot be forgotten"):
            memory_fs.forget(self.root, relative_path=".requests/note.md", confirmed=True)

    def test_windows_reserved_slug_is_rejected_on_every_platform(self) -> None:
        with self.assertRaisesRegex(memory_fs.MemoryPluginError, "reserved Windows"):
            memory_fs.remember(
                self.root,
                category="references",
                slug="CON",
                title="Reserved",
                content="content",
                source="conversation:reserved",
            )

    def test_archive_inbox_requires_confirmation_and_is_recoverable(self) -> None:
        memory_fs.capture(
            self.root,
            title="候选",
            content="待确认内容。",
            source="conversation:candidate",
            date="2026-08-03",
        )

        with self.assertRaises(memory_fs.MemoryPluginError):
            memory_fs.archive_inbox(self.root, date="2026-08-03", confirmed=False)

        result = memory_fs.archive_inbox(self.root, date="2026-08-03", confirmed=True)
        self.assertTrue((self.root / result["archived_to"]).is_file())
        self.assertFalse((self.root / "inbox" / "2026-08-03.md").exists())

    @unittest.skipIf(os.name == "nt", "symlink creation commonly requires elevated Windows privileges")
    def test_expand_skips_symbolic_link_files(self) -> None:
        memory_fs.ensure_layout(self.root)
        outside = self.base / "outside.md"
        outside.write_text("# Secret\n\n不应被读取的唯一密语。\n", encoding="utf-8")
        (self.root / "memory" / "references" / "leak.md").symlink_to(outside)

        expanded = memory_fs.expand(self.root, query="唯一密语")

        self.assertEqual(expanded["matches"], [])

    @unittest.skipIf(os.name == "nt", "symlink creation commonly requires elevated Windows privileges")
    def test_symbolic_link_category_is_rejected(self) -> None:
        outside = self.base / "outside-directory"
        outside.mkdir()
        self.root.mkdir(parents=True)
        (self.root / "preferences").symlink_to(outside, target_is_directory=True)

        with self.assertRaisesRegex(memory_fs.MemoryPluginError, "symbolic-link directory"):
            memory_fs.ensure_layout(self.root)

    @unittest.skipIf(os.name == "nt", "symlink creation commonly requires elevated Windows privileges")
    def test_nested_symbolic_link_path_cannot_be_forgotten(self) -> None:
        memory_fs.remember(
            self.root,
            category="preferences",
            slug="protected",
            title="Protected",
            content="must remain",
            source="conversation:protected",
        )
        (self.root / "memory" / "projects" / "linked").symlink_to(
            self.root / "memory" / "preferences", target_is_directory=True
        )

        with self.assertRaisesRegex(memory_fs.MemoryPluginError, "symbolic-link"):
            memory_fs.forget(
                self.root,
                relative_path="memory/projects/linked/protected.md",
                confirmed=True,
            )

        self.assertTrue((self.root / "memory" / "preferences" / "protected.md").is_file())

    @unittest.skipIf(os.name == "nt", "symlink creation commonly requires elevated Windows privileges")
    def test_data_root_rejects_symbolic_linked_cognition_directory(self) -> None:
        self.user_dir.mkdir(parents=True)
        real_cognition = self.user_dir / "real-cognition"
        real_cognition.mkdir()
        (self.user_dir / "cognition").symlink_to(real_cognition, target_is_directory=True)

        with self.assertRaisesRegex(memory_fs.MemoryPluginError, "must not use symbolic links"):
            memory_fs.data_root(self.user_dir)

    def test_cli_stdout_is_one_json_line(self) -> None:
        stdout = io.StringIO()
        with contextlib.redirect_stdout(stdout):
            exit_code = memory_fs.main(["--user-dir", str(self.user_dir), "status"])

        lines = stdout.getvalue().splitlines()
        self.assertEqual(exit_code, 0)
        self.assertEqual(len(lines), 1)
        self.assertTrue(json.loads(lines[0])["success"])


if __name__ == "__main__":
    unittest.main()
