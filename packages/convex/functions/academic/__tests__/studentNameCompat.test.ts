import { expect, test } from "vitest";
import { getReadableUserName, resolveStoredUserNameFields } from "../studentNameCompat";

test("two-word first name becomes first and middle without splitting a compound surname", () => {
  expect(resolveStoredUserNameFields({ firstName: "mary anne", lastName: "van dyke" })).toEqual({ name: "Mary Anne Van Dyke", firstName: "Mary", middleName: "Anne", lastName: "Van Dyke" });
  expect(getReadableUserName({ name: "Mary Anne Van Dyke", firstName: "Mary Anne", lastName: "Van Dyke" })).toEqual({ displayName: "Mary Anne Van Dyke", firstName: "Mary", middleName: "Anne", lastName: "Van Dyke" });
});

test("explicit middle and compound fields are preserved; omission retains and null clears", () => {
  expect(resolveStoredUserNameFields({ firstName: "Mary Anne", middleName: "Helen", lastName: "Van Dyke" })).toMatchObject({ firstName: "Mary Anne", middleName: "Helen", name: "Mary Anne Helen Van Dyke" });
  const fallback = { fallbackName: "Ada Grace Okafor", fallbackFirstName: "Ada", fallbackMiddleName: "Grace", fallbackLastName: "Okafor" };
  expect(resolveStoredUserNameFields({ ...fallback, lastName: "Van Okafor" })).toMatchObject({ name: "Ada Grace Van Okafor", middleName: "Grace" });
  expect(resolveStoredUserNameFields({ ...fallback, middleName: null })).toMatchObject({ name: "Ada Okafor", middleName: undefined });
});

test("ambiguous full-name-only records remain full names and unchanged fields do not erase parts", () => {
  expect(getReadableUserName({ name: "Mary Anne van Dyke" })).toEqual({ displayName: "Mary Anne Van Dyke", firstName: null, middleName: null, lastName: null });
  expect(resolveStoredUserNameFields({ fallbackName: "John Smith" })).toEqual({ name: "John Smith", firstName: undefined, middleName: undefined, lastName: undefined });
  expect(resolveStoredUserNameFields({ name: "Ada Grace Okafor", fallbackName: "Ada Grace Okafor", fallbackFirstName: "Ada", fallbackMiddleName: "Grace", fallbackLastName: "Okafor" })).toMatchObject({ firstName: "Ada", middleName: "Grace" });
  expect(resolveStoredUserNameFields({ name: "Changed Whole Name", fallbackName: "Ada Grace Okafor", fallbackFirstName: "Ada", fallbackMiddleName: "Grace", fallbackLastName: "Okafor" })).toMatchObject({ name: "Changed Whole Name", firstName: undefined, middleName: undefined, lastName: undefined });
});

test("more-than-two-word and hyphenated first names are not split", () => {
  expect(resolveStoredUserNameFields({ firstName: "Mary Anne Jane", lastName: "Van Dyke" })).toMatchObject({ firstName: "Mary Anne Jane", middleName: undefined });
  expect(resolveStoredUserNameFields({ firstName: "Mary-Anne", lastName: "Van Dyke" })).toMatchObject({ firstName: "Mary-Anne", middleName: undefined });
});
