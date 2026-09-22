import { comparePassword, hashPassword } from "@/lib/auth";
import { generateTemporaryPassword } from "./cliente";

describe("GAP 1: Temporary password generation for new usuarios", () => {
  it("should demonstrate that empty password prevents login (the bug)", async () => {
    // The bug: Usuario was created with password: ""
    const emptyPasswordHash = "";
    
    // Test: Can user login with any password?
    const canLoginWithPassword = await comparePassword("myPassword123", emptyPasswordHash);
    expect(canLoginWithPassword).toBe(false);
    
    // Test: Can user login with empty string?
    const canLoginWithEmpty = await comparePassword("", emptyPasswordHash);
    expect(canLoginWithEmpty).toBe(false);
    
    // IMPACT: User created but CANNOT login with any password (lockout)
  });

  it("should generate temporary password and allow login", async () => {
    // SOLUTION: Generate temporary password on user creation
    const tempPassword = generateTemporaryPassword();
    
    // Should match format: TempPass-XXXXXX
    expect(tempPassword).toMatch(/^TempPass-[A-Z0-9]{6}$/);
    
    // Hash it like the repository does
    const hashedPassword = await hashPassword(tempPassword);
    expect(hashedPassword).not.toBe("");
    expect(hashedPassword).not.toBe(tempPassword);
    
    // User should be able to login with temp password
    const canLogin = await comparePassword(tempPassword, hashedPassword);
    expect(canLogin).toBe(true);
    
    // Cannot login with wrong password
    const canLoginWrong = await comparePassword("wrongPassword", hashedPassword);
    expect(canLoginWrong).toBe(false);
  });

  it("should generate unique temporary passwords", () => {
    const password1 = generateTemporaryPassword();
    const password2 = generateTemporaryPassword();
    
    // Each should be valid format
    expect(password1).toMatch(/^TempPass-[A-Z0-9]{6}$/);
    expect(password2).toMatch(/^TempPass-[A-Z0-9]{6}$/);
    
    // Should be different (very likely)
    expect(password1).not.toBe(password2);
  });
});
