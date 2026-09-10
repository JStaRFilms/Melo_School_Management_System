"use client";

import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../../../packages/convex/_generated/api";
import type { Id } from "../../../../packages/convex/_generated/dataModel";
import { GroupBranchAccessManager } from "@school/shared/group-branch-access";
import { getErrorMessage } from "@school/shared/toast";

const groups = api.functions.academic.groups;

type Branch = {
  schoolId: Id<"schools">;
  name: string;
  slug: string;
  status: string;
};

export default function GroupBranchAccess({
  groupId,
  groupSlug,
  branches,
}: {
  groupId: Id<"schoolGroups">;
  groupSlug: string;
  branches: Branch[];
}) {
  const [sourceSchoolId, setSourceSchoolId] = useState<Id<"schools">>();
  const [targetSchoolId, setTargetSchoolId] = useState<Id<"schools">>();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    text: string;
  }>();
  const candidates = usePaginatedQuery(
    groups.listGroupStaffCandidates,
    sourceSchoolId && targetSchoolId
      ? { groupId, sourceSchoolId, targetSchoolId }
      : "skip",
    { initialNumItems: 25 },
  );
  const roleTemplates = useQuery(
    groups.listGroupAssignableRoleTemplates,
    targetSchoolId ? { groupId, targetSchoolId } : "skip",
  );
  const branchStaff = usePaginatedQuery(
    groups.listGroupBranchStaff,
    targetSchoolId ? { groupId, schoolId: targetSchoolId } : "skip",
    { initialNumItems: 25 },
  );
  const assign = useMutation(groups.assignUserToBranch);
  const revoke = useMutation(groups.revokeUserBranchMembership);

  return (
    <GroupBranchAccessManager
      groupSlug={groupSlug}
      branches={branches}
      candidates={candidates.results}
      roleTemplates={roleTemplates ?? []}
      branchStaff={branchStaff.results}
      candidatesLoading={candidates.status === "LoadingFirstPage"}
      branchStaffLoading={branchStaff.status === "LoadingFirstPage"}
      canLoadMoreCandidates={candidates.status === "CanLoadMore"}
      canLoadMoreStaff={branchStaff.status === "CanLoadMore"}
      pending={pending}
      message={message}
      onSelectionChange={({ sourceSchoolId: source, targetSchoolId: target }) => {
        setSourceSchoolId(
          branches.find((branch) => branch.schoolId === source)?.schoolId,
        );
        setTargetSchoolId(
          branches.find((branch) => branch.schoolId === target)?.schoolId,
        );
        setMessage(undefined);
      }}
      onAssign={async (input) => {
        const person = candidates.results.find(
          (candidate) => candidate.personId === input.personId,
        );
        const roleTemplate = roleTemplates?.find(
          (template) => template.roleTemplateId === input.roleTemplateId,
        );
        if (!sourceSchoolId || !targetSchoolId || !person) return false;
        setPending(true);
        setMessage(undefined);
        try {
          const result = await assign({
            groupId,
            sourceSchoolId,
            targetSchoolId,
            personId: person.personId,
            role: input.role,
            roleTemplateId: roleTemplate?.roleTemplateId,
            displayTitle: input.displayTitle,
            confirmation: input.confirmation,
          });
          setMessage({
            kind: "success",
            text: result.alreadyActive
              ? "This person already has active access to the destination branch."
              : "Branch access granted. The existing login can now use the branch switcher.",
          });
          return true;
        } catch (error) {
          setMessage({ kind: "error", text: getErrorMessage(error) });
          return false;
        } finally {
          setPending(false);
        }
      }}
      onRevoke={async (input) => {
        const person = branchStaff.results.find(
          (member) => member.personId === input.personId,
        );
        if (!targetSchoolId || !person) return false;
        setPending(true);
        setMessage(undefined);
        try {
          await revoke({
            groupId,
            schoolId: targetSchoolId,
            personId: person.personId,
            reason: input.reason,
            confirmation: input.confirmation,
          });
          setMessage({ kind: "success", text: "Branch access revoked." });
          return true;
        } catch (error) {
          setMessage({ kind: "error", text: getErrorMessage(error) });
          return false;
        } finally {
          setPending(false);
        }
      }}
      onLoadMoreCandidates={() => candidates.loadMore(25)}
      onLoadMoreStaff={() => branchStaff.loadMore(25)}
    />
  );
}
