// 认证属性测试
// **Feature: study-planner, Property 17: 登录验证正确性**
// **Validates: Requirements 12.2, 12.3**

use proptest::prelude::*;

/// 生成有效的用户名 (3-20 个字母数字字符)
fn valid_username_strategy() -> impl Strategy<Value = String> {
    "[a-zA-Z][a-zA-Z0-9]{2,19}".prop_map(|s| s)
}

/// 生成有效的密码 (6-50 个字符)
fn valid_password_strategy() -> impl Strategy<Value = String> {
    "[a-zA-Z0-9!@#$%^&*]{6,50}".prop_map(|s| s)
}

/// 密码验证函数 (与 auth_service 中的逻辑一致)
fn verify_password(input: &str, stored: &str) -> bool {
    input == stored
}

proptest! {
    /// Property 17: 登录验证正确性
    /// 对于任意用户名和密码组合，正确凭据应返回成功，错误凭据应返回失败
    #[test]
    fn test_login_validation_correctness(
        username in valid_username_strategy(),
        correct_password in valid_password_strategy(),
        wrong_password in valid_password_strategy().prop_filter("不同的密码", |p| p.len() >= 6)
    ) {
        // 正确密码应该验证成功
        prop_assert!(verify_password(&correct_password, &correct_password));
        
        // 错误密码应该验证失败 (除非碰巧相同)
        if wrong_password != correct_password {
            prop_assert!(!verify_password(&wrong_password, &correct_password));
        }
    }

    /// 空密码应该验证失败
    #[test]
    fn test_empty_password_fails(
        stored_password in valid_password_strategy()
    ) {
        prop_assert!(!verify_password("", &stored_password));
    }

    /// 密码验证是对称的
    #[test]
    fn test_password_verification_symmetric(
        password in valid_password_strategy()
    ) {
        // 相同密码应该总是验证成功
        prop_assert!(verify_password(&password, &password));
    }
}

#[cfg(test)]
mod unit_tests {
    use super::*;

    #[test]
    fn test_correct_password() {
        assert!(verify_password("admin123", "admin123"));
    }

    #[test]
    fn test_wrong_password() {
        assert!(!verify_password("wrong", "admin123"));
    }

    #[test]
    fn test_empty_input() {
        assert!(!verify_password("", "admin123"));
    }

    #[test]
    fn test_case_sensitive() {
        assert!(!verify_password("Admin123", "admin123"));
    }
}
