using System.Runtime.CompilerServices;
using Xunit;

[assembly: CollectionBehavior(DisableTestParallelization = true)]

namespace EnglishMastery.Tests;

public static class TestAssemblyInitializer
{
    [ModuleInitializer]
    public static void Initialize()
    {
        // Enforce test environment isolation: tests must NEVER write to EnglishMasteryDev
        Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Testing");
        Environment.SetEnvironmentVariable(
            "ConnectionStrings__DefaultConnection",
            "Server=localhost;Database=EnglishMasteryTest;Trusted_Connection=True;TrustServerCertificate=True;");
    }
}
